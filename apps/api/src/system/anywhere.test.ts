import assert from "node:assert/strict";
import test from "node:test";
import { anywhereLight, type AnywhereSettings, type AnywhereStatus } from "./anywhere.js";

const now = 10_000_000;
const on: AnywhereSettings = { enabled: true, name: "smith", key: "k".repeat(40), doorDomain: "nexternel.net" };
const st = (s: Partial<AnywhereStatus>): AnywhereStatus => ({
  state: "open", name: "smith", since: now - 1_000, address: "smith.nexternel.net", gpsPort: null, error: null, seen: now - 1_000, ...s,
});

test("light: green only when the line is open and the padlock is there", () => {
  assert.equal(anywhereLight(on, st({}), true, now).light, "green");
  assert.equal(anywhereLight(on, st({}), false, now).light, "orange");
  assert.equal(anywhereLight(on, st({ since: now - 11 * 60_000 }), false, now).light, "red");
});

test("light: not set up or off is grey", () => {
  assert.equal(anywhereLight({ ...on, name: null }, null, false, now).light, "off");
  assert.equal(anywhereLight({ ...on, enabled: false }, st({}), true, now).light, "off");
});

test("light: a silent link, a refused key or no door for long is red; connecting a short while is orange", () => {
  assert.equal(anywhereLight(on, null, true, now).light, "red");
  assert.equal(anywhereLight(on, st({ seen: now - 120_000 }), true, now).light, "red");
  assert.equal(anywhereLight(on, st({ state: "refused" }), true, now).light, "red");
  assert.equal(anywhereLight(on, st({ state: "connecting", since: now - 30_000 }), true, now).light, "orange");
  assert.equal(anywhereLight(on, st({ state: "connecting", since: now - 3 * 60_000 }), true, now).light, "red");
});

test("light: while the link has not caught up with a new name, it is connecting, not red", () => {
  assert.deepEqual(anywhereLight(on, st({ state: "refused", name: "old-name" }), true, now), { light: "orange", text: "Connecting…" });
});
