import assert from "node:assert/strict";
import test from "node:test";
import { SWITCH_STYLES, normalizeSwitchStyle, readPanelSwitchStyle } from "./switch-styles.ts";

test("twelve switch styles, the classic toggle first", () => {
  assert.equal(SWITCH_STYLES.length, 12);
  assert.equal(SWITCH_STYLES[0].id, "toggle");
});

test("a panel that has not chosen shows the classic toggle", () => {
  assert.equal(readPanelSwitchStyle({}), "toggle");
  assert.equal(readPanelSwitchStyle({ appearance: { layout: "card" } }), "toggle");
});

test("a panel's own choice is kept", () => {
  assert.equal(readPanelSwitchStyle({ appearance: { switchStyle: "rocker" } }), "rocker");
});

test("unknown styles fall back to the toggle", () => {
  assert.equal(readPanelSwitchStyle({ appearance: { switchStyle: "bear" } }), "toggle");
  assert.equal(normalizeSwitchStyle(undefined), "toggle");
});
