import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyLegacyTopicRootToPayload,
  remapTopicForLegacyRoots,
  remapTopicRoot,
} from "../migrate/topic-remap.js";

test("remapTopicRoot replaces installation prefix segment", () => {
  assert.equal(
    remapTopicRoot("damnhome/garden-relays/sensor/temp/state", "nexternel"),
    "nexternel/garden-relays/sensor/temp/state"
  );
});

test("remapTopicForLegacyRoots leaves Shelly Gen1 shellies prefix unchanged", () => {
  const topic = "shellies/shelly1-abc/relay/0/state";
  assert.equal(
    remapTopicForLegacyRoots(topic, "nexternel", ["damnhome"]),
    topic
  );
});

test("remapTopicForLegacyRoots leaves Shelly Gen3 device prefix unchanged", () => {
  const topic = "shellyplus1pm-abc/status/switch:0";
  assert.equal(
    remapTopicForLegacyRoots(topic, "nexternel", ["damnhome"]),
    topic
  );
});

test("applyLegacyTopicRootToPayload remaps ESPHome devices only", () => {
  const payload = {
    devices: [
      {
        mqttTopicPrefix: "damnhome/garden-relays",
        sensors: [{ mqttStateTopic: "damnhome/garden-relays/sensor/temp/state" }],
        relays: [
          {
            mqttStateTopic: "damnhome/garden-relays/switch/pump/state",
            mqttCommandTopic: "damnhome/garden-relays/switch/pump/command",
          },
        ],
      },
      {
        mqttTopicPrefix: "shellies/shelly1-abc",
        sensors: [],
        relays: [
          {
            mqttStateTopic: "shellies/shelly1-abc/relay/0",
            mqttCommandTopic: "shellies/shelly1-abc/relay/0/command",
          },
        ],
      },
    ],
  };

  const remapped = applyLegacyTopicRootToPayload(payload, "nexternel", ["damnhome"]);
  assert.equal(remapped.devices[0]!.mqttTopicPrefix, "nexternel/garden-relays");
  assert.equal(
    remapped.devices[0]!.sensors[0]!.mqttStateTopic,
    "nexternel/garden-relays/sensor/temp/state"
  );
  assert.equal(remapped.devices[1]!.mqttTopicPrefix, "shellies/shelly1-abc");
  assert.equal(
    remapped.devices[1]!.relays[0]!.mqttStateTopic,
    "shellies/shelly1-abc/relay/0"
  );
});
