import assert from "node:assert/strict";
import test from "node:test";
import { isPanelType, isPluginType } from "./counts.js";

test("gauge and air quality count as panels not plugins", () => {
  assert.equal(isPanelType("panel.gauge"), true);
  assert.equal(isPluginType("panel.gauge"), false);
  assert.equal(isPanelType("plugin.gauge"), true);
  assert.equal(isPluginType("plugin.gauge"), false);
  assert.equal(isPanelType("panel.air-quality"), true);
  assert.equal(isPluginType("plugin.air-quality"), false);
});

test("clock counts as plugin panel", () => {
  assert.equal(isPluginType("plugin.clock"), true);
  assert.equal(isPanelType("plugin.clock"), false);
});
