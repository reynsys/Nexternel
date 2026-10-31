import assert from "node:assert/strict";
import test from "node:test";
import fs from "fs";
import os from "os";
import path from "path";
import { sharedSettingsHash } from "./shared-settings.js";

test("the shared board settings fingerprint changes exactly when a shared file changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-pkg-"));
  fs.writeFileSync(path.join(dir, "nexternel-device.yaml"), "wifi:\n  power_save_mode: none\n");
  const a = sharedSettingsHash(dir);
  assert.equal(sharedSettingsHash(dir), a);
  fs.writeFileSync(path.join(dir, "nexternel-device.yaml"), "wifi:\n  power_save_mode: none\ninterval: []\n");
  assert.notEqual(sharedSettingsHash(dir), a);
  assert.equal(sharedSettingsHash(path.join(dir, "missing")), null);
});
