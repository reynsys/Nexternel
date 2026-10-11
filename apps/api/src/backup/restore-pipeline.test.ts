import { test } from "node:test";
import assert from "node:assert/strict";
import { packInnerArchive, openBackup, sealBackup, readDomainFromZip } from "./format.js";
import { decryptPayload, encryptPayload } from "./crypto.js";
import { remapDomainForCurrentServer } from "./post-restore.js";
import { buildHomeInventory, compareHomeInventories } from "./home-inventory.js";
import { rewriteEsphomeSecretsYaml } from "../migrate/esphome-rewrite.js";
import type { DomainExport } from "./domain-export.js";

function representativeDomain(): DomainExport {
  return {
    exportVersion: 1,
    areas: [{ id: "a1", name: "Garden", description: null, sortOrder: 0 }],
    devices: [
      {
        id: "d-esphome",
        roomId: "a1",
        name: "Garden Relays",
        slug: "garden-relays",
        esphomeName: "garden-relays",
        mqttTopicPrefix: "damnhome/garden-relays",
        ipAddress: null,
        macAddress: null,
        firmwareType: "esphome",
        isEnabled: true,
        sensors: [],
        relays: [{
          id: "r1",
          name: "Pump",
          slug: "pump",
          mqttStateTopic: "damnhome/garden-relays/relay/0",
          mqttCommandTopic: "damnhome/garden-relays/relay/0/set",
          esphomeEntityId: null,
          gpioPin: null,
          isEnabled: true,
          lastState: null,
        }],
      },
      {
        id: "d-shelly1",
        roomId: "a1",
        name: "Shelly Gen1",
        slug: "shelly-gen1",
        esphomeName: null,
        mqttTopicPrefix: "damnhome/shelly-gen1",
        ipAddress: "192.168.1.120",
        macAddress: null,
        firmwareType: "shelly",
        isEnabled: true,
        sensors: [],
        relays: [],
      },
      {
        id: "d-shelly3",
        roomId: "a1",
        name: "Shelly Gen3",
        slug: "shelly-gen3",
        esphomeName: null,
        mqttTopicPrefix: "damnhome/shelly-gen3",
        ipAddress: "192.168.1.121",
        macAddress: null,
        firmwareType: "shelly",
        isEnabled: true,
        sensors: [],
        relays: [],
      },
    ],
    dashboards: [{ id: "dash1", name: "Main", document: {}, isDefault: true }],
    cameras: [{
      id: "cam1",
      name: "Front",
      streamId: "front",
      rtspUrl: "rtsp://cam",
      areaId: "a1",
      enabled: true,
      sortOrder: 0,
    }],
    capabilities: [
      {
        id: "cap1",
        deviceId: "d-esphome",
        kind: "switch",
        name: "Pump",
        unit: null,
        sourceType: "relay",
        sourceId: "r1",
        isEnabled: true,
        systemId: "irrigation",
        groupId: null,
        areaId: "a1",
        serviceId: null,
      },
    ],
    capabilityBindings: [],
    groups: [],
    users: [{ id: "u1", username: "admin", passwordHash: "hash", displayName: "Admin", isActive: true, role: "admin", themePrefs: {}, avatarData: null }],
    roles: [],
    integrations: { octopus: null },
  };
}

test("backup encrypt/decrypt does not expose plaintext in outer blob", async () => {
  const domain = representativeDomain();
  const { zipBuffer } = await packInnerArchive({
    domain,
    esphome: [],
    influx: [],
    operational: {
      mqttUsername: "old",
      mqttPassword: "oldsecret",
      mqttTopicPrefix: "damnhome",
      serverIp: "192.168.1.50",
    },
    includeHistory: false,
  });
  const password = "integration-test-password";
  const sealed = sealBackup(password, zipBuffer);
  assert.ok(!sealed.toString("utf8").includes("damnhome"));
  assert.ok(!sealed.toString("utf8").includes("192.168.1.50"));
  const { innerZip } = await openBackup(password, sealed);
  const restored = await readDomainFromZip(innerZip);
  assert.equal(restored.devices.length, 3);
});

test("restore pipeline adapts infrastructure while preserving home inventory", async () => {
  const originalEnv = process.env.MQTT_TOPIC_PREFIX;
  process.env.MQTT_TOPIC_PREFIX = "nexternel";
  try {
    const domain = representativeDomain();
    const inventoryBefore = buildHomeInventory(domain);

    const { zipBuffer } = await packInnerArchive({
      domain,
      esphome: [
        {
          rel: "secrets.yaml",
          data: Buffer.from("mqtt_broker: 192.168.1.50\nmqtt_username: old\n"),
        },
      ],
      influx: [],
      operational: {
        mqttUsername: "olduser",
        mqttPassword: "oldpass",
        mqttTopicPrefix: "damnhome",
        serverIp: "192.168.1.50",
      },
      includeHistory: false,
    });

    const password = "restore-pipeline-test";
    const sealed = sealBackup(password, zipBuffer);
    const { innerZip } = await openBackup(password, sealed);
    let restoredDomain = await readDomainFromZip(innerZip);
    restoredDomain = remapDomainForCurrentServer(restoredDomain);

    const inventoryAfter = buildHomeInventory(restoredDomain);
    const compare = compareHomeInventories(inventoryBefore, inventoryAfter, {
      allowTopicPrefixChange: true,
    });
    assert.equal(compare.ok, true, compare.mismatches.join("; "));

    const esphomeSecrets = await innerZip.file("esphome/secrets.yaml")!.async("string");
    const adaptedSecrets = rewriteEsphomeSecretsYaml(esphomeSecrets, {
      brokerIp: "192.168.4.10",
      mqttUsername: "nexternel",
      mqttPassword: "newpass",
    });
    assert.match(adaptedSecrets, /mqtt_broker: 192\.168\.4\.10/);
    assert.doesNotMatch(adaptedSecrets, /192\.168\.1\.50/);

  } finally {
    if (originalEnv === undefined) delete process.env.MQTT_TOPIC_PREFIX;
    else process.env.MQTT_TOPIC_PREFIX = originalEnv;
  }
});

test("wrong password cannot decrypt backup", async () => {
  const domain = representativeDomain();
  const { zipBuffer } = await packInnerArchive({
    domain,
    esphome: [],
    influx: [],
    operational: null,
    includeHistory: false,
  });
  const sealed = sealBackup("correct-password", zipBuffer);
  await assert.rejects(
    () => openBackup("wrong-password", sealed),
    /backup_password_invalid/
  );
});

test("corrupt encrypted backup fails", () => {
  const blob = encryptPayload("pw", Buffer.from("x"));
  blob[10] = blob[10]! ^ 0xff;
  assert.throws(() => decryptPayload("pw", blob), /backup_password_invalid/);
});
