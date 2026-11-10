import assert from "node:assert/strict";
import test from "node:test";
import { HOME_NAME_MAX, normalizeHomeName } from "./home.js";

test("home name: trimmed, single spaces, limited length, never anything but text", () => {
  assert.equal(normalizeHomeName("  The   Taylors'  house "), "The Taylors' house");
  assert.equal(normalizeHomeName("x".repeat(200)).length, HOME_NAME_MAX);
  assert.equal(normalizeHomeName(42), "");
  assert.equal(normalizeHomeName(undefined), "");
});
