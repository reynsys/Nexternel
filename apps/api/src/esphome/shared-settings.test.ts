import assert from "node:assert/strict";
import test from "node:test";
import fs from "fs";
import os from "os";
import path from "path";
import { sharedSettingsHash, sharedSettingsNews } from "./shared-settings.js";

test("the shared board settings fingerprint changes exactly when a shared file changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-pkg-"));
  fs.writeFileSync(path.join(dir, "nexternel-device.yaml"), "wifi:\n  power_save_mode: none\n");
  const a = sharedSettingsHash(dir);
  assert.equal(sharedSettingsHash(dir), a);
  fs.writeFileSync(path.join(dir, "nexternel-device.yaml"), "wifi:\n  power_save_mode: none\ninterval: []\n");
  assert.notEqual(sharedSettingsHash(dir), a);
  assert.equal(sharedSettingsHash(path.join(dir, "missing")), null);
});

test("comments and blank lines never change the fingerprint (no board looks out of date for an explanation)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-pkg-"));
  const file = path.join(dir, "nexternel-device.yaml");
  fs.writeFileSync(file, "wifi:\n  power_save_mode: none\n");
  const a = sharedSettingsHash(dir);
  fs.writeFileSync(file, "# What's new\n# - V5.2.168: emergency Wi-Fi hotspot\n\nwifi:\n  # why\n  power_save_mode: none\n");
  assert.equal(sharedSettingsHash(dir), a);
});

test("the newest What's new line names the reason boards need the shared settings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-pkg-"));
  fs.writeFileSync(path.join(dir, "nexternel-device.yaml"), "# What's new\n# - V5.2.159: health report\n# - V5.2.168: emergency Wi-Fi hotspot\nwifi: {}\n");
  assert.equal(sharedSettingsNews(dir), "V5.2.168: emergency Wi-Fi hotspot");
  assert.equal(sharedSettingsNews(path.join(dir, "missing")), null);
});
