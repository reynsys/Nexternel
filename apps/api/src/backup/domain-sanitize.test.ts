import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDomainForRestore } from "./domain-sanitize.js";
import type { DomainExport } from "./domain-export.js";

const baseDomain = (): DomainExport => ({
  exportVersion: 1,
  areas: [{ id: "area-1", name: "Living Room", description: null, sortOrder: 0 }],
  devices: [
    {
      id: "dev-1",
      roomId: "area-1",
      name: "Fan",
      slug: "fan",
      esphomeName: "fan",
      mqttTopicPrefix: "nexternel/fan",
      ipAddress: null,
      macAddress: null,
      firmwareType: "esphome",
      isEnabled: true,
      sensors: [],
      relays: [],
    },
  ],
  dashboards: [],
  cameras: [],
  capabilities: [
    {
      id: "cap-1",
      deviceId: "dev-1",
      kind: "switch",
      name: "Fan Relay",
      unit: null,
      sourceType: "relay",
      sourceId: "relay-1",
      isEnabled: true,
      systemId: null,
      groupId: null,
      areaId: "deleted-area",
      serviceId: null,
    },
    {
      id: "cap-2",
      deviceId: "missing-device",
      kind: "switch",
      name: "Ghost Relay",
      unit: null,
      sourceType: "relay",
      sourceId: "relay-2",
      isEnabled: true,
      systemId: null,
      groupId: null,
      areaId: null,
      serviceId: null,
    },
  ],
  capabilityBindings: [],
  groups: [],
  users: [],
  roles: [],
  integrations: { octopus: null },
});

test("sanitize drops orphan capabilities and clears invalid area_id", () => {
  const result = sanitizeDomainForRestore(baseDomain());
  assert.equal(result.domain.capabilities.length, 1);
  assert.equal(result.domain.capabilities[0]?.name, "Fan Relay");
  assert.equal(result.domain.capabilities[0]?.areaId, null);
  assert.deepEqual(result.skippedCapabilities, ["Ghost Relay"]);
});
