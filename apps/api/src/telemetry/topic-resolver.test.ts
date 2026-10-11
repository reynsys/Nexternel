import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clearLiveTopicMap,
  getLiveTopicBindings,
  parseEsphomeStateTopic,
  registerEsphomeEntityTopics,
  registerLiveTopicBinding,
} from "./topic-resolver.js";

test("parseEsphomeStateTopic parses garden relay state", () => {
  const parts = parseEsphomeStateTopic(
    "nexternel/garden-relays/switch/relay_1/state"
  );
  assert.ok(parts);
  assert.equal(parts!.segment, "switch");
  assert.equal(parts!.entityId, "relay_1");
  assert.equal(parts!.slug, "garden-relays");
});

test("registerEsphomeEntityTopics indexes slug alias prefix", () => {
  clearLiveTopicMap();
  registerEsphomeEntityTopics({
    capabilityId: "cap-1",
    kind: "switch",
    devicePrefix: "damnhome/garden-relays",
    deviceSlug: "garden-relays",
    entityId: "relay_1",
    segment: "switch",
  });
  const live = getLiveTopicBindings(
    "nexternel/garden-relays/switch/relay_1/state"
  );
  assert.equal(live.length, 1);
  assert.equal(live[0]!.capabilityId, "cap-1");
});

test("registerLiveTopicBinding dedupes capability ids", () => {
  clearLiveTopicMap();
  registerLiveTopicBinding("nexternel/x/sensor/t/state", "cap-1", "temperature");
  registerLiveTopicBinding("nexternel/x/sensor/t/state", "cap-1", "temperature");
  assert.equal(getLiveTopicBindings("nexternel/x/sensor/t/state").length, 1);
});
