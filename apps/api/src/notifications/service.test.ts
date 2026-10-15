import assert from "node:assert/strict";
import test from "node:test";
import { normalizePluginBell, pluginMessageLevel } from "./service.js";

test("plugins never post red: act now becomes keep an eye on it", () => {
  assert.equal(pluginMessageLevel("alert", "all"), "warning");
  assert.equal(pluginMessageLevel("warning", "all"), "warning");
  assert.equal(pluginMessageLevel("info", "all"), "info");
});

test("'important only' (the default) keeps plain information out of the bell", () => {
  assert.equal(normalizePluginBell(undefined), "important");
  assert.equal(pluginMessageLevel("info", "important"), null);
  assert.equal(pluginMessageLevel(undefined, "important"), null);
  assert.equal(pluginMessageLevel("alert", "important"), "warning");
});

test("'none' keeps every message of the plugin out of the bell", () => {
  assert.equal(pluginMessageLevel("alert", "none"), null);
});
