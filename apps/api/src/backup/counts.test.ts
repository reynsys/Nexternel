import assert from "node:assert/strict";
import test from "node:test";
import { isPanelType, isPluginType, restoreCountsProblem } from "./counts.js";

test("gauge counts as a panel, also under its old plugin name", () => {
  assert.equal(isPanelType("panel.gauge"), true);
  assert.equal(isPluginType("panel.gauge"), false);
  assert.equal(isPanelType("plugin.gauge"), true);
  assert.equal(isPluginType("plugin.gauge"), false);
});

test("clock is built in now: its old plugin name counts as a panel", () => {
  assert.equal(isPanelType("panel.clock"), true);
  assert.equal(isPanelType("plugin.clock"), true);
  assert.equal(isPluginType("plugin.clock"), false);
});

test("panels from installed plugins count as plugins", () => {
  assert.equal(isPluginType("plugin.ai-assistant"), true);
  assert.equal(isPanelType("plugin.ai-assistant"), false);
});

test("restore check: a new home with no areas or devices restores fine; missing ones are named", () => {
  const empty = { areas: 0, devices: 0, users: 1 };
  assert.equal(restoreCountsProblem(empty, empty), null);
  assert.equal(restoreCountsProblem({ areas: 8, devices: 10, users: 3 }, { areas: 8, devices: 10, users: 3 }), null);
  assert.match(restoreCountsProblem({ areas: 8, devices: 10, users: 3 }, { areas: 8, devices: 7, users: 3 }) ?? "", /3 of 10 devices/);
  assert.match(restoreCountsProblem(null, { areas: 0, devices: 0, users: 0 }) ?? "", /No accounts/);
  assert.equal(restoreCountsProblem(null, { areas: 0, devices: 0, users: 1 }), null);
});
