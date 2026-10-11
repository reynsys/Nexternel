import assert from "node:assert/strict";
import test from "node:test";
import { validatePluginManifest, SUPPORTED_PLUGIN_API_VERSIONS } from "./validate.js";

const samplePluginManifest = {
  id: "nexternel.test-plugin",
  version: "1.0.0",
  pluginApi: 1,
  contributes: { widgets: ["plugin.clock"] },
};

test("validatePluginManifest accepts a valid plugin manifest", () => {
  const result = validatePluginManifest(samplePluginManifest);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.manifest.id, samplePluginManifest.id);
    assert.equal(result.manifest.version, samplePluginManifest.version);
    assert.equal(result.manifest.pluginApi, 1);
  }
});

test("validatePluginManifest rejects unsupported pluginApi", () => {
  const result = validatePluginManifest({
    ...samplePluginManifest,
    pluginApi: 99,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.join(" "), /pluginApi/);
  }
});

test("validatePluginManifest rejects non-plugin panel types", () => {
  const result = validatePluginManifest({
    id: "nexternel.bad",
    version: "1.0.0",
    pluginApi: SUPPORTED_PLUGIN_API_VERSIONS[0],
    contributes: { widgets: ["panel.gauge"] },
  });
  assert.equal(result.ok, false);
});

test("validatePluginManifest rejects missing contributes", () => {
  const result = validatePluginManifest({
    id: "nexternel.empty",
    version: "1.0.0",
    pluginApi: 1,
  });
  assert.equal(result.ok, false);
});
