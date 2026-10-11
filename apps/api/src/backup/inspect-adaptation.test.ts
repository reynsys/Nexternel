import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNetworkAdaptationPreview } from "./inspect-adaptation.js";
import type { BackupManifest } from "./types.js";

function manifest(): BackupManifest {
  return {
    format: "nexternel-backup",
    formatVersion: 1,
    domainExportVersion: 1,
    schemaGeneration: 4,
    appVersion: "V4.0.031",
    createdAt: "2026-08-08T12:00:00.000Z",
    installationId: "old-install-id",
    components: {
      home: true,
      esphome: true,
      automations: true,
      history: true,
      operational: true,
    },
    counts: {
      areas: 9,
      devices: 10,
      capabilities: 27,
      dashboards: 6,
      panels: 0,
      plugins: 0,
      cameras: 3,
      users: 1,
      roles: 2,
      automationsIncluded: true,
      historyIncluded: true,
    },
    compatibility: { minRestoreAppVersion: "V4.0.000", notes: [] },
    integrity: { payloadSha256: "abc", algorithm: "sha256" },
  };
}

test("flags different installation and wifi requirement", () => {
  const preview = buildNetworkAdaptationPreview({
    manifest: manifest(),
    operational: {
      mqttUsername: "old",
      mqttPassword: "old",
      mqttTopicPrefix: "damnhome",
      serverIp: "192.168.1.50",
    },
    esphomeFiles: [
      {
        rel: "secrets.yaml",
        data: Buffer.from("mqtt_broker: 192.168.1.50\nwifi_ssid: Home\n"),
      },
    ],
  });
  assert.equal(preview.backupServerIp, "192.168.1.50");
  assert.equal(preview.backupMqttTopicPrefix, "damnhome");
  assert.equal(preview.wifiMayBeRequired, true);
  assert.equal(preview.usersInBackup, 1);
});
