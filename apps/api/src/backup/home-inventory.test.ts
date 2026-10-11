import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHomeInventory, compareHomeInventories } from "./home-inventory.js";
import type { DomainExport } from "./domain-export.js";

function sampleDomain(): DomainExport {
  return {
    exportVersion: 1,
    areas: [
      { id: "a1", name: "Garden", description: null, sortOrder: 0 },
      { id: "a2", name: "Living Room", description: null, sortOrder: 1 },
    ],
    devices: [
      {
        id: "d1",
        roomId: "a1",
        name: "Garden Relays",
        slug: "garden-relays",
        esphomeName: "garden-relays",
        mqttTopicPrefix: "damnhome/garden-relays",
        ipAddress: null,
        macAddress: null,
        firmwareType: "esphome",
        isEnabled: true,
        sensors: [{
          id: "s1",
          name: "Temp",
          slug: "temp",
          sensorType: "temperature",
          unit: "°C",
          mqttStateTopic: "damnhome/garden-relays/sensor/temp",
          esphomeEntityId: null,
          gpioPin: null,
          isEnabled: true,
        }],
        relays: [],
      },
      {
        id: "d2",
        roomId: "a2",
        name: "Kitchen Shelly",
        slug: "kitchen-shelly",
        esphomeName: null,
        mqttTopicPrefix: "damnhome/kitchen-shelly",
        ipAddress: "192.168.1.120",
        macAddress: null,
        firmwareType: "shelly",
        isEnabled: true,
        sensors: [],
        relays: [{
          id: "r1",
          name: "Light",
          slug: "light",
          mqttStateTopic: "damnhome/kitchen-shelly/relay/0",
          mqttCommandTopic: "damnhome/kitchen-shelly/relay/0/set",
          esphomeEntityId: null,
          gpioPin: null,
          isEnabled: true,
          lastState: null,
        }],
      },
      {
        id: "d3",
        roomId: "a2",
        name: "Hall Shelly Gen3",
        slug: "hall-shelly",
        esphomeName: null,
        mqttTopicPrefix: "damnhome/hall-shelly",
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
      rtspUrl: "rtsp://x",
      areaId: "a2",
      enabled: true,
      sortOrder: 0,
    }],
    capabilities: [
      {
        id: "c1",
        deviceId: "d1",
        kind: "temperature",
        name: "Garden Temp",
        unit: "°C",
        sourceType: "sensor",
        sourceId: "s1",
        isEnabled: true,
        systemId: "climate",
        groupId: null,
        areaId: "a1",
        serviceId: null,
      },
      {
        id: "c2",
        deviceId: "d2",
        kind: "switch",
        name: "Kitchen Light",
        unit: null,
        sourceType: "relay",
        sourceId: "r1",
        isEnabled: true,
        systemId: "lighting",
        groupId: null,
        areaId: "a2",
        serviceId: null,
      },
    ],
    capabilityBindings: [
      {
        id: "b1",
        capabilityId: "c2",
        protocol: "mqtt",
        stateTopic: "damnhome/kitchen-shelly/relay/0",
        commandTopic: "damnhome/kitchen-shelly/relay/0/set",
        valueMap: {},
      },
    ],
    groups: [],
    users: [{ id: "u1", username: "admin", passwordHash: "x", displayName: "Admin", isActive: true, role: "admin", themePrefs: {}, avatarData: null }],
    roles: [],
    integrations: { octopus: null },
  };
}

test("inventory preserves device identity across topic prefix change", () => {
  const before = buildHomeInventory(sampleDomain());
  const afterDomain = structuredClone(sampleDomain());
  for (const d of afterDomain.devices) {
    d.mqttTopicPrefix = d.mqttTopicPrefix.replace(/^damnhome/, "nexternel");
    for (const s of d.sensors) {
      s.mqttStateTopic = s.mqttStateTopic.replace(/^damnhome/, "nexternel");
    }
    for (const r of d.relays) {
      r.mqttStateTopic = r.mqttStateTopic.replace(/^damnhome/, "nexternel");
      r.mqttCommandTopic = r.mqttCommandTopic.replace(/^damnhome/, "nexternel");
    }
  }
  for (const b of afterDomain.capabilityBindings) {
    if (b.stateTopic) b.stateTopic = b.stateTopic.replace(/^damnhome/, "nexternel");
    if (b.commandTopic) b.commandTopic = b.commandTopic.replace(/^damnhome/, "nexternel");
  }
  const after = buildHomeInventory(afterDomain);
  const result = compareHomeInventories(before, after, { allowTopicPrefixChange: true });
  assert.equal(result.ok, true, result.mismatches.join("; "));
  assert.equal(before.devices.length, 3);
  assert.ok(before.devices.some((d) => d.firmwareType === "shelly"));
  assert.ok(before.devices.some((d) => d.firmwareType === "esphome"));
});

test("inventory detects device loss", () => {
  const before = buildHomeInventory(sampleDomain());
  const afterDomain = structuredClone(sampleDomain());
  afterDomain.devices = afterDomain.devices.filter((d) => d.slug !== "hall-shelly");
  const after = buildHomeInventory(afterDomain);
  const result = compareHomeInventories(before, after, { allowTopicPrefixChange: true });
  assert.equal(result.ok, false);
  assert.ok(result.mismatches.some((m) => m.includes("Devices count")));
});
