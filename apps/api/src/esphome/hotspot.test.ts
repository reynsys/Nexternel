import assert from "node:assert/strict";
import test from "node:test";
import fs from "fs";
import os from "os";
import path from "path";
import { ensureHotspotPassword, hotspotPassword, ownHotspot, SECRET } from "./hotspot.js";

test("the hotspot password is added once and never changed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-hotspot-"));
  fs.writeFileSync(path.join(dir, "secrets.yaml"), 'wifi_ssid: "Home"\nwifi_password: "x"');
  assert.equal(ensureHotspotPassword(dir), true);
  const first = hotspotPassword(dir);
  assert.ok(first && first.length === 12);
  assert.equal(ensureHotspotPassword(dir), false);
  assert.equal(hotspotPassword(dir), first);
  const text = fs.readFileSync(path.join(dir, "secrets.yaml"), "utf8");
  assert.match(text, /^wifi_password: "x"\n/m);
  assert.equal(text.match(new RegExp(`^${SECRET}:`, "gm"))?.length, 1);
});

test("no secrets file: nothing is written", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nx-hotspot-"));
  assert.equal(ensureHotspotPassword(dir), false);
  assert.equal(hotspotPassword(dir), null);
});

test("a board's own hotspot is found, with its name from the substitutions", () => {
  const yaml = [
    "substitutions:",
    '  ap_ssid: "Kids Room Fallback Hotspot"',
    "wifi:",
    '  ssid: "${wifi_ssid}"',
    "  ap:",
    '    ssid: "${ap_ssid}"',
    '    password: "${ap_password}"',
    "",
    "captive_portal:",
  ].join("\n");
  assert.deepEqual(ownHotspot(yaml), { name: "Kids Room Fallback Hotspot" });
});

test("a board without its own hotspot uses the shared one", () => {
  const yaml = ["wifi:", "  ssid: !secret wifi_ssid", "  password: !secret wifi_password", "", "captive_portal:", "", "mqtt:", "  ap: not-wifi"].join("\n");
  assert.equal(ownHotspot(yaml), null);
});
