import { test } from "node:test";
import assert from "node:assert/strict";
import { assertValidShellyMqttPrefix } from "./validate.js";

test("assertValidShellyMqttPrefix rejects installation root for Gen2/Gen3", () => {
  assert.throws(() => assertValidShellyMqttPrefix("nexternel", "nexternel"));
  assert.doesNotThrow(() =>
    assertValidShellyMqttPrefix("shelly1minig3-cc8da25b0074", "nexternel")
  );
  assert.doesNotThrow(() =>
    assertValidShellyMqttPrefix("shellies/shelly1-abc", "nexternel")
  );
});
