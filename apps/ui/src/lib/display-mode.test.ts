import assert from "node:assert/strict";
import test from "node:test";
import { displayPath, parseDisplayOptions } from "./display-mode.ts";

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
