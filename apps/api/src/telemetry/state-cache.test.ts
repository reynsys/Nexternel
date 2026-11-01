import assert from "node:assert/strict";
import test from "node:test";
import { isNoReading, parseMqttPayload } from "./state-cache.js";

test("a board that cannot read its sensor sends nan: that is no reading, not a value", () => {
  for (const raw of ["nan", "NaN", " nan ", "inf", "-inf", "Infinity"]) {
    assert.equal(isNoReading(parseMqttPayload("temperature", raw)), true, raw);
  }
  assert.equal(isNoReading(Number.NaN), true);
});

test("real readings (also 0 and negative) are kept as values", () => {
  for (const raw of ["0", "23.8", "-4.5", "49"]) {
    const v = parseMqttPayload("temperature", raw);
    assert.equal(typeof v, "number", raw);
    assert.equal(isNoReading(v), false, raw);
  }
  assert.equal(isNoReading("on"), false);
  assert.equal(isNoReading(null), false);
});
