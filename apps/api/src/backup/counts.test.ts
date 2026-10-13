import assert from "node:assert/strict";
import test from "node:test";
import { isPanelType, isPluginType } from "./counts.js";

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
