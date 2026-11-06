import assert from "node:assert/strict";
import test from "node:test";
import { clampToStep, colorFromPoint, controlStateOf, controlSummary, deviceColour, dialShare, fanWord, isDeviceControlKind, isWhiteLight, shareFromPoint, splitTemperature } from "./control-view.ts";

test("the whole degrees stay the same with and without a half", () => {
  assert.deepEqual(splitTemperature(21.5), { whole: 21, half: ".5" });
  assert.deepEqual(splitTemperature(22), { whole: 22, half: "" });
});

test("a dragged temperature lands on the device's steps", () => {
  assert.equal(clampToStep(21.3, 10, 30, 0.5), 21.5);
  assert.equal(clampToStep(40, 10, 30, 0.5), 30);
});

test("the centre of the wheel is white, the top is red", () => {
  assert.equal(colorFromPoint(0, 0).s, 0);
  assert.equal(colorFromPoint(0, -1).h, 0);
});

test("the list view says the state briefly", () => {
  assert.equal(controlSummary("thermostat", { on: true, target: 21.5 }), "21.5°");
  assert.equal(controlSummary("light", { on: false, brightness: 60 }), "Off");
  assert.equal(controlSummary("light", { on: true, brightness: 60 }), "60%");
  assert.equal(controlSummary("climate", { on: true, mode: "fan", target: 22 }), "Fan");
});

test("only the new control kinds count, and any value is safe", () => {
  assert.equal(isDeviceControlKind("climate"), true);
  assert.equal(isDeviceControlKind("switch"), false);
  assert.deepEqual(controlStateOf("nan"), {});
});

test("the dial's gap at the bottom goes to the nearer end", () => {
  assert.equal(shareFromPoint(-1, 1), 0);
  assert.ok(Math.abs(shareFromPoint(1, 1) - 1) < 0.001);
  assert.equal(shareFromPoint(-0.1, 1), 0);
  assert.equal(shareFromPoint(0.1, 1), 1);
  assert.ok(Math.abs(shareFromPoint(0, -1) - 0.5) < 0.001);
  assert.equal(dialShare(99, 10, 30), 1);
});

test("white light is white lights, or a colour with no colour in it", () => {
  assert.equal(isWhiteLight({ white: true }), true);
  assert.equal(isWhiteLight({ color: { h: 10, s: 0 } }), true);
  assert.equal(isWhiteLight({ color: { h: 10, s: 1 } }), false);
});

test("each air conditioning mode has its colour, Auto takes the Look's", () => {
  assert.equal(deviceColour("climate", { mode: "cool" }, {}, "#f00"), "#5cc8ff");
  assert.equal(deviceColour("climate", { mode: "auto" }, {}, "#f00"), "#f00");
});

test("the one-line panel says the state briefly for blinds and fans", () => {
  assert.equal(controlSummary("cover", { position: 40 }), "40%");
  assert.equal(controlSummary("cover", { position: 0 }), "Closed");
  assert.equal(controlSummary("fan", { on: true, speed: 55 }), "Medium");
  assert.equal(fanWord(90), "High");
});
