import { test } from "node:test";
import assert from "node:assert/strict";
import { boardIdFor, isUpdatePasswordRefusal } from "./bring-in.js";

test("a found board maps to a board kind Nexternel knows, or none", () => {
  assert.equal(boardIdFor("esp32dev")?.id, "esp32dev");
  assert.equal(boardIdFor("NodeMCUv2")?.platform, "esp8266");
  assert.equal(boardIdFor("esp32-s3-devkitc-1"), null);
  assert.equal(boardIdFor(null), null);
});

test("an update-password refusal is told apart from other failures", () => {
  assert.equal(isUpdatePasswordRefusal("ERROR Error auth result: Authentication invalid. Is the password correct?"), true);
  assert.equal(isUpdatePasswordRefusal("ERROR Connecting to 10.0.0.5:3232 failed: timed out"), false);
});
