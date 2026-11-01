import assert from "node:assert/strict";
import test from "node:test";
import { SENSOR_NOT_ANSWERING, parseCapabilityReading } from "./parse-capability-reading.ts";

const cap = (value: unknown, quality: string) => ({ unit: "°C", state: { value, quality, updatedAt: "2026-11-01T16:00:00Z" } });

test("a reading whose board cannot read the sensor says so (panels and the Devices page)", () => {
  assert.deepEqual(parseCapabilityReading(cap(null, "error")), { value: SENSOR_NOT_ANSWERING, unit: "" });
});

test("a normal reading shows its value and unit; no reading yet shows a dash", () => {
  assert.deepEqual(parseCapabilityReading(cap(23.8, "good")), { value: "23.8", unit: "°C" });
  assert.deepEqual(parseCapabilityReading(cap(21, "stale")), { value: "—", unit: "" });
});
