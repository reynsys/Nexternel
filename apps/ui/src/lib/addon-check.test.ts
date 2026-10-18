import assert from "node:assert/strict";
import test from "node:test";
import type { AddonInfo } from "../api";
import { describeAddonCheck } from "./addon-check.ts";

const hud = (version: string, checkedAt: string | null, status: AddonInfo["status"] = "active"): AddonInfo => ({
  id: "look-hud", name: "HUD Looks", kind: "look", version, description: null, licenceId: "N1", holder: null,
  status, message: null, validUntil: null, installedAt: "2026-10-01", checkedAt,
});

test("the check says what changed, or that nothing did", () => {
  assert.deepEqual(describeAddonCheck([hud("1.5.1", "a")], [hud("1.5.2", "b")]), { text: "Updated: HUD Looks to 1.5.2.", ok: true });
  assert.deepEqual(describeAddonCheck([hud("1.5.1", "a")], [hud("1.5.1", "b")]), { text: "All add-ons are up to date.", ok: true });
  assert.equal(describeAddonCheck([hud("1.5.1", "a")], [hud("1.5.1", "a")]).ok, false);
  assert.match(describeAddonCheck([hud("1.5.1", "a")], [hud("1.5.1", "a", "revoked")]).text, /No longer included/);
});
