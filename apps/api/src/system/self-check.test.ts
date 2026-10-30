import assert from "node:assert/strict";
import test from "node:test";
import { availableVersionOf, diskLevel } from "./self-check.ts";

test("update messages are recognised by the version they announce", () => {
  assert.equal(availableVersionOf("Nexternel V5.2.144 is available"), "V5.2.144");
  assert.equal(availableVersionOf("Garden Relay 1 went offline"), null);
});

test("disk space: low under 10 % or 2 GB, very low under 5 % or 1 GB", () => {
  assert.equal(diskLevel(50e9, 100e9), "ok");
  assert.equal(diskLevel(8e9, 100e9), "low");
  assert.equal(diskLevel(4e9, 100e9), "very-low");
  assert.equal(diskLevel(1.5e9, 10e9), "low");
  assert.equal(diskLevel(0.5e9, 4e9), "very-low");
});
