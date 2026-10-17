import assert from "node:assert/strict";
import test from "node:test";
import { parseThemePrefsInput, themePrefsFromDb } from "./theme-prefs.js";

const base = { mode: "dark", primary: "#1A73E8", skinId: "mui-dashboard" };

test("a chosen Look is saved, including one installed only on another server", () => {
  assert.equal(parseThemePrefsInput({ ...base, lookId: "glass" })?.lookId, "glass");
  assert.equal(parseThemePrefsInput({ ...base, lookId: "hud" })?.lookId, "hud");
});

test("prefs from before Looks get Glass for frosted panels over a background, else Standard", () => {
  assert.equal(themePrefsFromDb({ ...base, gradientId: "seascape", solidContentPanels: false }).lookId, "glass");
  assert.equal(themePrefsFromDb({ ...base, effectId: "snow" }).lookId, "glass");
  assert.equal(themePrefsFromDb({ ...base, gradientId: "seascape", solidContentPanels: true }).lookId, "standard");
  assert.equal(themePrefsFromDb({ ...base }).lookId, "standard");
  assert.equal(themePrefsFromDb(null).lookId, "standard");
});

test("a Look id that is not a short lowercase name is not stored", () => {
  assert.equal(parseThemePrefsInput({ ...base, lookId: "../../etc" })?.lookId, "standard");
});

test("the starting switch style is kept when known, else the classic toggle", () => {
  assert.equal(parseThemePrefsInput({ ...base, switchStyle: "gears" })?.switchStyle, "gears");
  assert.equal(parseThemePrefsInput({ ...base, switchStyle: "bear" })?.switchStyle, "toggle");
  assert.equal(themePrefsFromDb({ ...base }).switchStyle, "toggle");
});
