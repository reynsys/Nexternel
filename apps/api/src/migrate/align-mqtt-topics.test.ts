import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectLegacyInstallationRoots,
  installationMqttRoot,
} from "./align-mqtt-topics.js";
import { remapTopicForLegacyRoots } from "./topic-remap.js";
import { parseMqttPayload } from "../telemetry/state-cache.js";

test("installationMqttRoot reads MQTT_TOPIC_PREFIX", () => {
  const prev = process.env.MQTT_TOPIC_PREFIX;
  process.env.MQTT_TOPIC_PREFIX = "nexternel";
  try {
    assert.equal(installationMqttRoot(), "nexternel");
  } finally {
    if (prev === undefined) delete process.env.MQTT_TOPIC_PREFIX;
    else process.env.MQTT_TOPIC_PREFIX = prev;
  }
});

test("detectLegacyInstallationRoots finds damnhome not shellies", () => {
  const roots = detectLegacyInstallationRoots([
    "damnhome/garden-relays",
    "nexternel/utility-room",
    "shellies/shelly1-abc",
    "shellyplus1pm-abc",
  ]);
  assert.ok(roots.includes("damnhome"));
  assert.ok(!roots.includes("shellies"));
  assert.ok(!roots.includes("nexternel"));
});

test("remap ESPHome topics from damnhome to nexternel", () => {
  const legacy = ["damnhome"];
  assert.equal(
    remapTopicForLegacyRoots(
      "damnhome/garden-relays/switch/relay_1/state",
      "nexternel",
      legacy
    ),
    "nexternel/garden-relays/switch/relay_1/state"
  );
  assert.equal(
    remapTopicForLegacyRoots(
      "damnhome/utility-room/sensor/utility_room_temperature/state",
      "nexternel",
      legacy
    ),
    "nexternel/utility-room/sensor/utility_room_temperature/state"
  );
});

test("remap ESPHome command topics from damnhome to nexternel", () => {
  const legacy = ["damnhome"];
  assert.equal(
    remapTopicForLegacyRoots(
      "damnhome/garden-relays/switch/relay_1/command",
      "nexternel",
      legacy
    ),
    "nexternel/garden-relays/switch/relay_1/command"
  );
});

test("remap migrated HA-style ESPHome sensor entity ids unchanged", () => {
  const legacy = ["damnhome"];
  assert.equal(
    remapTopicForLegacyRoots(
      "damnhome/glow-energy/sensor/house_-_power_consumption/state",
      "nexternel",
      legacy
    ),
    "nexternel/glow-energy/sensor/house_-_power_consumption/state"
  );
});

test("parseMqttPayload switch handles ESPHome ON/OFF and Shelly on/off", () => {
  assert.equal(parseMqttPayload("switch", "ON"), true);
  assert.equal(parseMqttPayload("switch", "OFF"), false);
  assert.equal(parseMqttPayload("switch", "on"), true);
  assert.equal(parseMqttPayload("switch", "off"), false);
  assert.equal(parseMqttPayload("switch", '{"output":true}'), true);
});

test("parseMqttPayload sensor parses numeric values", () => {
  assert.equal(parseMqttPayload("temperature", "29.1"), 29.1);
});
