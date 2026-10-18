import assert from "node:assert/strict";
import test from "node:test";
import { displayPath, normalizeWallPrefs, parseDisplayOptions } from "./display-mode.ts";

test("display options come from the address, with wall-friendly defaults", () => {
  assert.deepEqual(parseDisplayOptions(""), { active: true, textSize: 110, tabs: true, rotate: 0, light: true });
  assert.deepEqual(parseDisplayOptions("?text=125&tabs=0&rotate=30&light=0"), { active: true, textSize: 125, tabs: false, rotate: 30, light: false });
  assert.equal(parseDisplayOptions("?rotate=3").rotate, 0);
  assert.equal(parseDisplayOptions("?text=300").textSize, 110);
});

test("a dashboard's address in Display mode", () => {
  assert.equal(displayPath("/"), "/display");
  assert.equal(displayPath("/d/kids-bedroom"), "/display/kids-bedroom");
});

test("the account's wall settings apply unless the address says otherwise", () => {
  const wall = normalizeWallPrefs({ textSize: 125, tabs: false, rotate: 60, light: false, start: "d1" });
  assert.deepEqual(parseDisplayOptions("", wall), { active: true, textSize: 125, tabs: false, rotate: 60, light: false });
  assert.deepEqual(parseDisplayOptions("?tabs=1&rotate=0", wall), { active: true, textSize: 125, tabs: true, rotate: 0, light: false });
  assert.deepEqual(normalizeWallPrefs(undefined), { textSize: 110, tabs: true, rotate: 0, light: true, start: null });
});
