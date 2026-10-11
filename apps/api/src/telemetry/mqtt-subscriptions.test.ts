import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectMqttSubscriptionTopics,
  deviceSlugFromMqttPrefix,
} from "./mqtt-subscriptions.js";

test("collectMqttSubscriptionTopics includes installation root wildcard", () => {
  const topics = collectMqttSubscriptionTopics({
    installationRoot: "nexternel",
    devicePrefixes: ["nexternel/garden-relays"],
    bindingStateTopics: ["nexternel/utility-room/sensor/utility_room_temperature/state"],
  });
  assert.ok(topics.includes("nexternel/#"));
  assert.ok(topics.includes("nexternel/garden-relays/#"));
  assert.ok(
    topics.includes("nexternel/utility-room/sensor/utility_room_temperature/state")
  );
});

test("collectMqttSubscriptionTopics keeps Shelly prefixes separate", () => {
  const topics = collectMqttSubscriptionTopics({
    installationRoot: "nexternel",
    devicePrefixes: ["shellies/shelly1-ABCDEF", "shelly1minig3-cc8da25b0074"],
    bindingStateTopics: ["shellies/shelly1-ABCDEF/relay/0"],
  });
  assert.ok(topics.includes("shellies/shelly1-ABCDEF/#"));
  assert.ok(topics.includes("shelly1minig3-cc8da25b0074/#"));
  assert.ok(!topics.some((t) => t.startsWith("nexternel/shellies")));
});

test("deviceSlugFromMqttPrefix extracts slug after installation root", () => {
  assert.equal(deviceSlugFromMqttPrefix("nexternel/garden-relays"), "garden-relays");
  assert.equal(deviceSlugFromMqttPrefix("damnhome/glow-energy"), "glow-energy");
  assert.equal(deviceSlugFromMqttPrefix("shellies/shelly1-abc"), "shelly1-abc");
});
