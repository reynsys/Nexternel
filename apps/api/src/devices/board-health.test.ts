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
