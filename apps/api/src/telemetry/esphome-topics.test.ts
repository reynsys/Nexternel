import { test } from "node:test";
import assert from "node:assert/strict";
import {
  esphomeDevicePrefixAliases,
  esphomeSensorStateTopic,
  esphomeSwitchCommandTopic,
  esphomeSwitchStateTopic,
} from "./esphome-topics.js";

test("esphomeSensorStateTopic builds standard path", () => {
  assert.equal(
    esphomeSensorStateTopic(
      "nexternel/utility-room",
      "utility_room_temperature"
    ),
    "nexternel/utility-room/sensor/utility_room_temperature/state"
  );
});

test("esphomeSwitchStateTopic and command topic", () => {
  assert.equal(
    esphomeSwitchStateTopic("nexternel/garden-relays", "relay_1"),
    "nexternel/garden-relays/switch/relay_1/state"
  );
  assert.equal(
    esphomeSwitchCommandTopic("nexternel/garden-relays", "relay_1"),
    "nexternel/garden-relays/switch/relay_1/command"
  );
});

test("esphomeDevicePrefixAliases includes installation root slug path", () => {
  const aliases = esphomeDevicePrefixAliases(
    "damnhome/garden-relays",
    "garden-relays",
    "nexternel"
  );
  assert.ok(aliases.includes("damnhome/garden-relays"));
  assert.ok(aliases.includes("nexternel/garden-relays"));
});
