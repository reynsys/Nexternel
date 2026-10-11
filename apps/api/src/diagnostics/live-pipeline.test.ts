import { test } from "node:test";
import assert from "node:assert/strict";
import type { DeviceDetail } from "../devices/service.js";
import { diagnoseDevice } from "./live-pipeline.js";

function sampleDevice(overrides: Partial<DeviceDetail> = {}): DeviceDetail {
  return {
    id: "d1",
    roomId: "r1",
    roomName: "Garden",
    name: "Garden Relays",
    slug: "garden-relays",
    mqttTopicPrefix: "nexternel/garden-relays",
    esphomeName: "garden-relays",
    firmwareType: "esphome",
    ipAddress: "192.168.7.50",
    macAddress: null,
    isEnabled: true,
    isOnline: false,
    connectivityState: "offline",
    lastSeenAt: null,
    sensors: [],
    relays: [
      {
        id: "relay1",
        name: "Pump",
        slug: "pump",
        esphomeEntityId: "pump",
        mqttCommandTopic: "nexternel/garden-relays/switch/pump/command",
        mqttStateTopic: "nexternel/garden-relays/switch/pump/state",
        lastState: null,
        isEnabled: true,
        capabilityId: "cap1",
        systemId: null,
      },
    ],
    ...overrides,
  };
}

const mqttDiagBase = {
  status: "connected" as const,
  lastError: null,
  broker: "mqtt://mosquitto:1883",
  connected: true,
  subscribedTopicCount: 1,
  subscribedTopics: ["nexternel/garden-relays/#"],
  indexedStateTopicCount: 1,
  indexedStateTopics: ["nexternel/garden-relays/switch/pump/state"],
  devicePrefixCount: 1,
  devicePrefixes: ["nexternel/garden-relays"],
  shellyPrefixCount: 0,
  shellyPrefixes: [],
  shellySwitchBindingCount: 0,
  observationRingSize: 0,
  brokerSniff: { active: false, endsAt: null, topics: [] },
};

test("diagnoseDevice flags missing subscription", () => {
  const device = sampleDevice();
  const bindings = new Map([
    ["cap1", { stateTopic: device.relays[0]!.mqttStateTopic, commandTopic: device.relays[0]!.mqttCommandTopic }],
  ]);
  const diag = diagnoseDevice(device, {
    ...mqttDiagBase,
    subscribedTopics: [],
  }, bindings);
  assert.equal(diag.breakAt, "mqtt_subscription");
  assert.match(diag.summary, /not subscribed/i);
});

test("diagnoseDevice identifies shelly gen1 protocol", () => {
  const device = sampleDevice({
    name: "Shelly 1",
    firmwareType: "shelly",
    mqttTopicPrefix: "shellies/shelly1-ABCDEF",
    relays: [],
  });
  const diag = diagnoseDevice(device, mqttDiagBase, new Map());
  assert.equal(diag.protocol, "shelly-gen1");
});

test("diagnoseDevice identifies shelly gen3 protocol", () => {
  const device = sampleDevice({
    name: "Shelly Plus",
    firmwareType: "shelly",
    mqttTopicPrefix: "shellyplus1pm-abcdef123456",
    relays: [],
  });
  const diag = diagnoseDevice(device, mqttDiagBase, new Map());
  assert.equal(diag.protocol, "shelly-gen3");
});
