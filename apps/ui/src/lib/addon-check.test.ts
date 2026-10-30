import assert from "node:assert/strict";
import test from "node:test";
import type { AddonInfo } from "../api";
import { describeExtensionCheck } from "./addon-check.ts";

const hud = (version: string, checkedAt: string | null, status: AddonInfo["status"] = "active"): AddonInfo => ({
  id: "look-hud", name: "HUD Looks", kind: "look", version, description: null, licenceId: "N1", holder: null,
  status, message: null, validUntil: null, installedAt: "2026-10-01", checkedAt,
});

test("the check says what changed, or that nothing did", () => {
  assert.deepEqual(describeExtensionCheck([hud("1.5.1", "a")], [hud("1.5.2", "b")]), { text: "Updated: HUD Looks to 1.5.2.", ok: true });
  assert.deepEqual(describeExtensionCheck([hud("1.5.1", "a")], [hud("1.5.1", "b")]), { text: "Everything is up to date.", ok: true });
  assert.equal(describeExtensionCheck([hud("1.5.1", "a")], [hud("1.5.1", "a")]).ok, false);
  assert.match(describeExtensionCheck([hud("1.5.1", "a")], [hud("1.5.1", "a", "revoked")]).text, /No longer included/);
});

test("a feature with a newer version is named, never 'up to date'", () => {
  const r = describeExtensionCheck([hud("1.5.1", "a")], [hud("1.5.1", "b")], [{ name: "AI assistant", version: "1.2.0" }]);
  assert.equal(r.text, "Ready to update: AI assistant 1.2.0 — press Update next to it.");
  assert.deepEqual(describeExtensionCheck([], [], []), { text: "Everything is up to date.", ok: true });
});
