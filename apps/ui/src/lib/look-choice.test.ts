import assert from "node:assert/strict";
import test from "node:test";
import { isLookId, lookIdFromPrefs } from "./look-choice.ts";

test("a chosen Look is kept", () => {
  assert.equal(lookIdFromPrefs({ lookId: "glass", backdrop: false }), "glass");
  assert.equal(lookIdFromPrefs({ lookId: "standard", backdrop: true, solidContentPanels: false }), "standard");
});

test("a Look pack that is not installed here is still remembered", () => {
  assert.equal(lookIdFromPrefs({ lookId: "hud", backdrop: false }), "hud");
});

test("prefs from before Looks: frosted panels over a background become Glass", () => {
  assert.equal(lookIdFromPrefs({ backdrop: true, solidContentPanels: false }), "glass");
  assert.equal(lookIdFromPrefs({ backdrop: true }), "glass");
});

test("prefs from before Looks: solid panels or a plain background stay Standard", () => {
  assert.equal(lookIdFromPrefs({ backdrop: true, solidContentPanels: true }), "standard");
  assert.equal(lookIdFromPrefs({ backdrop: false, solidContentPanels: false }), "standard");
});

test("only short lowercase names are Look ids", () => {
  assert.equal(isLookId("hud-metal"), true);
  assert.equal(isLookId("HUD"), false);
  assert.equal(isLookId("../x"), false);
  assert.equal(isLookId(""), false);
  assert.equal(isLookId("a".repeat(41)), false);
});
