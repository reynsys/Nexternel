import assert from "node:assert/strict";
import test from "node:test";
import { nexternelVersionAtLeast, validatePluginManifest } from "./validate.js";
import { normalizeGrants, missingRequiredSettings } from "./service.js";
import { parseDeviceDefs } from "./devices.js";
import { clearPluginEvents, pushPluginEvent, waitForPluginEvents } from "./events.js";

const practice = {
  id: "practice",
  name: "Practice plugin",
  version: "1.0.0",
  pluginApi: 1,
  permissions: { devices: "Adds a pretend sensor", notify: "Says hello" },
  settings: [
    { key: "interval", label: "Seconds between readings", type: "number", default: 30, min: 5 },
    { key: "token", label: "Test secret", type: "secret" },
    { key: "mode", label: "Mode", type: "select", options: [{ value: "a", label: "A" }] },
  ],
};

test("a complete manifest is accepted and main defaults to main.mjs", () => {
  const result = validatePluginManifest(practice);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.manifest.main, "main.mjs");
    assert.equal(result.manifest.settings?.length, 3);
  }
});

test("ids must be plain lowercase (they become folder and device names)", () => {
  for (const id of ["Practice", "a", "with_underscore", "../x", "nexternel.test"]) {
    assert.equal(validatePluginManifest({ ...practice, id }).ok, false, id);
  }
});

test("unknown permissions and permissions without a reason are refused", () => {
  assert.equal(validatePluginManifest({ ...practice, permissions: { everything: "please" } }).ok, false);
  assert.equal(validatePluginManifest({ ...practice, permissions: { read: "" } }).ok, false);
});

test("a main file outside the package is refused", () => {
  assert.equal(validatePluginManifest({ ...practice, main: "../evil.mjs" }).ok, false);
  assert.equal(validatePluginManifest({ ...practice, main: "/etc/passwd" }).ok, false);
});

test("secret settings cannot carry a default and selects need options", () => {
  assert.equal(
    validatePluginManifest({ ...practice, settings: [{ key: "k", label: "K", type: "secret", default: "x" }] }).ok,
    false
  );
  assert.equal(validatePluginManifest({ ...practice, settings: [{ key: "s", label: "S", type: "select" }] }).ok, false);
});

test("version comparison", () => {
  assert.equal(nexternelVersionAtLeast("V5.2.86", "V5.2.86"), true);
  assert.equal(nexternelVersionAtLeast("V5.2.86", "V5.2.90"), false);
  assert.equal(nexternelVersionAtLeast("V5.3.0", "V5.2.90"), true);
  assert.equal(nexternelVersionAtLeast("V5.2.86", undefined), true);
});

test("grants never exceed what the plugin asked for", () => {
  const grants = normalizeGrants(
    { devices: true, read: "all", control: ["x"], notify: true },
    { devices: "why", notify: "why" }
  );
  assert.deepEqual(grants, { devices: true, read: null, control: [], notify: true });
});

test("required settings are reported until filled in", () => {
  const fields = [{ key: "url", label: "Server address", type: "text" as const, required: true }];
  assert.deepEqual(missingRequiredSettings(fields, {}), ["Server address"]);
  assert.deepEqual(missingRequiredSettings(fields, { url: "http://x" }), []);
});

test("device definitions are checked", () => {
  assert.equal(parseDeviceDefs([{ key: "main", name: "Main", items: [{ key: "temp", kind: "temperature" }] }]).ok, true);
  assert.equal(parseDeviceDefs([{ key: "Bad Key", items: [] }]).ok, false);
  assert.equal(parseDeviceDefs([{ key: "a", items: [{ key: "x" }, { key: "x" }] }]).ok, false);
  const parsed = parseDeviceDefs([{ key: "a", items: [{ key: "sw", control: true, kind: "temperature" }] }]);
  assert.equal(parsed.ok && parsed.devices[0]!.items[0]!.kind, "switch");
});

test("events wait for the plugin and are delivered once", async () => {
  clearPluginEvents("t");
  const waiting = waitForPluginEvents("t", 1000);
  pushPluginEvent("t", { type: "settings-changed" });
  assert.deepEqual(await waiting, [{ type: "settings-changed" }]);
  pushPluginEvent("t", { type: "settings-changed" });
  assert.equal((await waitForPluginEvents("t", 0)).length, 1);
  assert.equal((await waitForPluginEvents("t", 10)).length, 0);
});
