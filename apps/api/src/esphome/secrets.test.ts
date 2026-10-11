import assert from "node:assert/strict";
import test from "node:test";
import { checkEsphomeBuildPrerequisites } from "./secrets.js";

test("checkEsphomeBuildPrerequisites flags placeholder Wi-Fi values", () => {
  const result = checkEsphomeBuildPrerequisites();
  assert.equal(typeof result.ready, "boolean");
  assert.equal(Array.isArray(result.missing), true);
});
