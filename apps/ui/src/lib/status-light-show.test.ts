import assert from "node:assert/strict";
import test from "node:test";
import { lightToShow, readingCanHaveLight } from "./status-light-show.ts";

const limits = { enabled: true, limits: { watchHigh: 1000, alertHigh: 2000 }, notifyAfterMin: 10 };

test("a reading with limits shows its colour", () => {
  assert.equal(lightToShow({ state: "watch", settings: limits }, "co2", 1300), "watch");
});

test("a number reading without limits shows the empty 'not set up' light", () => {
  assert.equal(lightToShow(null, "power", 261), "unset");
  assert.equal(lightToShow({ state: null, settings: null }, "energy", "11.8"), "unset");
  assert.equal(lightToShow(null, "power", undefined), "unset");
});

test("a reading with limits but no value yet is grey (no recent reading)", () => {
  assert.equal(lightToShow({ state: null, settings: limits }, "co2", undefined), "stale");
});

test("switches, text values and lights switched off show nothing", () => {
  assert.equal(lightToShow(null, "switch", false), null);
  assert.equal(lightToShow(null, "number", "eco mode"), null);
  assert.equal(lightToShow({ state: "ok", settings: { ...limits, enabled: false } }, "co2", 500), null);
  assert.equal(readingCanHaveLight("camera"), false);
});
