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


test("animations are on unless turned off", () => {
  assert.equal(themePrefsFromDb({ ...base }).motion, true);
  assert.equal(parseThemePrefsInput({ ...base, motion: false })?.motion, false);
});

test("text size is one of the offered sizes, else normal; a Look font id is kept when well formed", () => {
  assert.equal(themePrefsFromDb({ ...base }).textSize, 100);
  assert.equal(parseThemePrefsInput({ ...base, textSize: 125 })?.textSize, 125);
  assert.equal(parseThemePrefsInput({ ...base, textSize: 400 })?.textSize, 100);
  assert.equal(parseThemePrefsInput({ ...base, lookFont: "michroma" })?.lookFont, "michroma");
  assert.equal(parseThemePrefsInput({ ...base, lookFont: "<b>" })?.lookFont, undefined);
});

test("a Look button style id is kept when well formed", () => {
  assert.equal(parseThemePrefsInput({ ...base, lookButtons: "style-two" })?.lookButtons, "style-two");
  assert.equal(parseThemePrefsInput({ ...base, lookButtons: "x y" })?.lookButtons, undefined);
});

test("wall display settings are kept within the offered choices", () => {
  assert.deepEqual(themePrefsFromDb({ ...base }).wall, { textSize: 110, tabs: true, rotate: 0, light: true, autoscroll: true, start: null });
  assert.deepEqual(parseThemePrefsInput({ ...base, wall: { textSize: 125, tabs: false, rotate: 60, light: false, autoscroll: false, start: "abc-123" } })?.wall, {
    textSize: 125, tabs: false, rotate: 60, light: false, autoscroll: false, start: "abc-123",
  });
  assert.equal(parseThemePrefsInput({ ...base, wall: { rotate: 3, start: "<x>" } })?.wall?.rotate, 0);
  assert.equal(parseThemePrefsInput({ ...base, wall: { start: "<x>" } })?.wall?.start, null);
});

test("the room menu is one of the offered places, else the dock", () => {
  assert.equal(themePrefsFromDb({ ...base }).roomNav, "dock");
  assert.equal(parseThemePrefsInput({ ...base, roomNav: "rail" })?.roomNav, "rail");
  assert.equal(parseThemePrefsInput({ ...base, roomNav: "x" })?.roomNav, "dock");
});
