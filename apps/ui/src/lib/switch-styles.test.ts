import assert from "node:assert/strict";
import test from "node:test";
import { SWITCH_STYLES, normalizeSwitchStyle, readPanelSwitchStyle, resolveSwitchStyle } from "./switch-styles.ts";

test("twelve switch styles, the classic toggle first", () => {
  assert.equal(SWITCH_STYLES.length, 12);
  assert.equal(SWITCH_STYLES[0].id, "toggle");
});

test("a panel without its own choice uses the person's starting style", () => {
  assert.equal(readPanelSwitchStyle({}), "default");
  assert.equal(readPanelSwitchStyle({ appearance: { layout: "card" } }), "default");
  assert.equal(resolveSwitchStyle("default", "gears"), "gears");
});

test("a panel's own choice wins", () => {
  assert.equal(readPanelSwitchStyle({ appearance: { switchStyle: "rocker" } }), "rocker");
  assert.equal(resolveSwitchStyle("rocker", "gears"), "rocker");
});

test("unknown styles fall back to the toggle", () => {
  assert.equal(readPanelSwitchStyle({ appearance: { switchStyle: "bear" } }), "default");
  assert.equal(normalizeSwitchStyle("bear"), "toggle");
  assert.equal(resolveSwitchStyle("default", undefined), "toggle");
});
