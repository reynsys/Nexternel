import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanControlChange,
  cleanControlReport,
  describeControlChange,
  parseControlFeatures,
  reportConfirms,
} from "./controls.ts";

test("heating gets a sensible range when the device gives none", () => {
  assert.deepEqual(parseControlFeatures("thermostat", {}), { min: 10, max: 30, step: 0.5 });
});

test("air conditioning keeps only the modes it has", () => {
  const f = parseControlFeatures("climate", { modes: ["cool", "nonsense"], fanSpeeds: ["low"] });
  assert.deepEqual(f.modes, ["cool"]);
  assert.deepEqual(f.fanSpeeds, ["low"]);
});

test("a temperature lands on the device's steps, inside its range", () => {
  const f = parseControlFeatures("thermostat", {});
  assert.deepEqual(cleanControlChange("thermostat", f, { target: 21.3 }), { target: 21.5 });
  assert.deepEqual(cleanControlChange("thermostat", f, { target: 99 }), { target: 30 });
});

test("a light without colour or white refuses them", () => {
  const f = parseControlFeatures("light", { brightness: true });
  assert.equal(cleanControlChange("light", f, { color: { h: 10, s: 1 } }), null);
  assert.equal(cleanControlChange("light", f, { white: true }), null);
  assert.deepEqual(cleanControlChange("light", f, { brightness: 500 }), { brightness: 100 });
});

test("white and colour replace each other", () => {
  const f = parseControlFeatures("light", { color: true, white: true });
  assert.deepEqual(cleanControlChange("light", f, { color: { h: 370, s: 2 } }), { color: { h: 10, s: 1 }, white: false });
  assert.deepEqual(cleanControlChange("light", f, { white: true, color: { h: 1, s: 1 } }), { white: true });
});

test("a mode the unit does not have is refused", () => {
  const f = parseControlFeatures("climate", { modes: ["cool"] });
  assert.equal(cleanControlChange("climate", f, { mode: "heat" }), null);
});

test("nothing valid means no change", () => {
  assert.equal(cleanControlChange("thermostat", parseControlFeatures("thermostat", {}), "hello"), null);
});

test("a change is confirmed only when all of it is reported", () => {
  assert.equal(reportConfirms({ on: true, target: 22 }, { target: 22 }), true);
  assert.equal(reportConfirms({ on: true, target: 21 }, { target: 22 }), false);
  assert.equal(reportConfirms({ color: { h: 100.2, s: 0.5 } }, { color: { h: 100, s: 0.5 } }), true);
});

test("reports keep only what Nexternel understands", () => {
  assert.deepEqual(cleanControlReport({ on: true, current: 19.5, nonsense: 1 }), { on: true, current: 19.5 });
  assert.equal(cleanControlReport("on"), null);
});

test("the Activity log says the change in words", () => {
  assert.equal(describeControlChange({ on: true, target: 22 }), "turned on, set to 22°");
});

test("blinds take a position from closed to open, and nothing else", () => {
  const f = parseControlFeatures("cover", {});
  assert.deepEqual(cleanControlChange("cover", f, { position: 140 }), { position: 100 });
  assert.equal(cleanControlChange("cover", f, { on: true }), null);
});

test("a fan takes on, off and a speed", () => {
  const f = parseControlFeatures("fan", {});
  assert.deepEqual(cleanControlChange("fan", f, { on: false, speed: 0 }), { on: false, speed: 1 });
});

test("heating accepts only the settings it declared", () => {
  const f = parseControlFeatures("thermostat", { presets: ["Comfort", "Eco"] });
  assert.deepEqual(cleanControlChange("thermostat", f, { preset: "Eco" }), { preset: "Eco" });
  assert.equal(cleanControlChange("thermostat", f, { preset: "Away" }), null);
});

test("a colour lamp with no white lights is confirmed by its colour alone", () => {
  const f = parseControlFeatures("light", { color: true });
  const wanted = cleanControlChange("light", f, { color: { h: 0, s: 0 } });
  assert.deepEqual(wanted, { color: { h: 0, s: 0 } });
  assert.equal(reportConfirms({ color: { h: 0, s: 0 } }, wanted!), true);
});
