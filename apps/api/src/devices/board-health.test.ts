import assert from "node:assert/strict";
import test from "node:test";
import { applyBoardHealthTopic, boardFingerprint } from "./board-health.js";

test("a board's software fingerprint is read from what the boards send (also kept/retained)", () => {
  const prefixOf = (t: string) => (t.startsWith("nexternel/kids-room/") ? "nexternel/kids-room" : null);
  assert.equal(applyBoardHealthTopic("nexternel/kids-room/sensor/software_fingerprint/state", "09518928", true, prefixOf), true);
  assert.equal(boardFingerprint("nexternel/kids-room"), "09518928");
  assert.equal(applyBoardHealthTopic("nexternel/kids-room/text_sensor/software_fingerprint/state", "0A0B0C0D", false, prefixOf), true);
  assert.equal(boardFingerprint("nexternel/kids-room"), "0a0b0c0d");
});

test("a fingerprint only counts while the board keeps repeating it (other software leaves an old kept copy)", async () => {
  const { FINGERPRINT_FRESH_MS } = await import("./board-health.js");
  const prefixOf = (t: string) => (t.startsWith("nexternel/garden/") ? "nexternel/garden" : null);
  // Kept copy from before the board got other software: counts at first, then no longer.
  applyBoardHealthTopic("nexternel/garden/sensor/software_fingerprint/state", "c90f6c7f", true, prefixOf);
  const now = Date.now();
  assert.equal(boardFingerprint("nexternel/garden", now), "c90f6c7f");
  assert.equal(boardFingerprint("nexternel/garden", now + FINGERPRINT_FRESH_MS + 1000), null);
  // A board that repeats it (health report each minute) keeps counting.
  applyBoardHealthTopic("nexternel/garden/health", JSON.stringify({ up: 60, fp: "C90F6C7F" }), false, prefixOf);
  assert.equal(boardFingerprint("nexternel/garden"), "c90f6c7f");
});

test("the health report: alive, Wi-Fi, drops, memory, why it last restarted", async () => {
  const { boardHealth, resetWords } = await import("./board-health.js");
  const prefixOf = (t: string) => (t.startsWith("nexternel/hallway/") ? "nexternel/hallway" : null);
  const payload = JSON.stringify({ up: 181, rssi: -57, wifi_drops: 2, mqtt_drops: 5, heap: 180000, heap_min: 150000, reset: 9, fp: "AD10A632", ver: "2026.9.1" });
  assert.equal(applyBoardHealthTopic("nexternel/hallway/health", payload, false, prefixOf), true);
  const h = boardHealth("nexternel/hallway");
  assert.equal(h.wifiDbm, -57);
  assert.equal(h.report?.mqttDrops, 5);
  assert.equal(h.report?.resetReason, "power dip (brownout)");
  assert.equal(boardFingerprint("nexternel/hallway"), "ad10a632");
  assert.equal(resetWords(undefined, "Hardware Watchdog"), "frozen and restarted by its watchdog");
});
