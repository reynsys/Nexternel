import assert from "node:assert/strict";
import test from "node:test";
import { parseClockConfig } from "./clock-config.ts";

test("a clock with no saved choices is a bold digital face in the theme", () => {
  const clock = parseClockConfig(undefined);
  assert.equal(clock.face, "digital");
  assert.equal(clock.font, "theme");
  assert.equal(clock.color, "text");
  assert.equal(clock.bold, true);
  assert.equal(clock.italic, false);
});

test("an older analog clock still opens as analog", () => {
  const clock = parseClockConfig({ faceStyle: "analog", analogClockStyle: "roman" });
  assert.equal(clock.face, "analog");
  assert.equal(clock.dial, "roman");
});

test("saved clock choices are kept", () => {
  const clock = parseClockConfig({
    clockFace: "analog",
    clockDial: "minimal",
    clockFont: "mono",
    clockBold: false,
    clockItalic: true,
    clockColor: "accent",
  });
  assert.deepEqual(clock, {
    face: "analog",
    dial: "minimal",
    font: "mono",
    bold: false,
    italic: true,
    color: "accent",
  });
});
