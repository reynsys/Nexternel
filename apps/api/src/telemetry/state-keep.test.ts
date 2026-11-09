import test from "node:test";
import assert from "node:assert/strict";
import { keptQuality } from "./state-keep.js";
import { sameLiveValue, seedLiveState, getLiveState, setLiveState } from "./state-cache.js";

test("a kept reading still recent after a restart counts as current; an older one does not", () => {
  const now = Date.parse("2026-11-09T12:00:00Z");
  assert.equal(keptQuality({ quality: "good", updatedAt: "2026-11-09T11:59:00Z" }, now), "good");
  assert.equal(keptQuality({ quality: "good", updatedAt: "2026-11-09T11:50:00Z" }, now), "stale");
  assert.equal(keptQuality({ quality: "stale", updatedAt: "2026-11-09T11:59:50Z" }, now), "stale");
  assert.equal(keptQuality({ quality: "error", updatedAt: "2026-11-09T11:59:50Z" }, now), "error");
});

test("same value: numbers, on/off and a thermostat's set of values", () => {
  assert.ok(sameLiveValue(21.4, 21.4));
  assert.ok(!sameLiveValue(21.4, 21.5));
  assert.ok(sameLiveValue(true, true));
  assert.ok(sameLiveValue({ on: true, target: 20.5 }, { on: true, target: 20.5 }));
  assert.ok(!sameLiveValue({ on: true, target: 20.5 }, { on: true, target: 21 }));
  // The database hands a set back in its own order.
  assert.ok(sameLiveValue({ on: true, color: { h: 30, s: 0.6 } }, { color: { s: 0.6, h: 30 }, on: true }));
});

test("a kept reading never replaces one that arrived after the start", () => {
  setLiveState("keep-test-1", 22, { quality: "good" });
  seedLiveState({ capabilityId: "keep-test-1", value: 18, quality: "good", updatedAt: "2026-11-09T11:00:00Z" });
  assert.equal(getLiveState("keep-test-1")?.value, 22);
  seedLiveState({ capabilityId: "keep-test-2", value: 18, quality: "stale", updatedAt: "2026-11-09T11:00:00Z" });
  assert.equal(getLiveState("keep-test-2")?.updatedAt, "2026-11-09T11:00:00Z");
});
