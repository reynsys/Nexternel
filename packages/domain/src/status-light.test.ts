import assert from "node:assert/strict";
import test from "node:test";
import { checkStatusLimits, defaultStatusSettings, readPanelStatusLight, statusOf, statusReason } from "./status-light.ts";

test("temperature has limits on both sides", () => {
  const l = defaultStatusSettings("temperature")!.limits;
  assert.equal(statusOf(21, l), "ok");
  assert.equal(statusOf(17, l), "watch");
  assert.equal(statusOf(25, l), "watch");
  assert.equal(statusOf(15.9, l), "alert");
  assert.equal(statusOf(28, l), "alert");
  assert.equal(statusReason(28, l, "alert", "°C"), "above 27 °C");
});

test("CO2 only has limits for too high", () => {
  const l = defaultStatusSettings("co2")!.limits;
  assert.equal(statusOf(400, l), "ok");
  assert.equal(statusOf(1300, l), "watch");
  assert.equal(statusOf("2100", l), "alert");
});

test("kinds without starting limits have no light, and non-numbers have no state", () => {
  assert.equal(defaultStatusSettings("power"), null);
  assert.equal(statusOf(true, { alertHigh: 1 }), null);
});

test("limits must be in order", () => {
  assert.equal(checkStatusLimits({ alertLow: 16, watchLow: 18, watchHigh: 24, alertHigh: 27 }), null);
  assert.match(checkStatusLimits({ watchHigh: 30, alertHigh: 27 }) ?? "", /must not be lower/);
});

test("panel light settings fall back to the defaults", () => {
  assert.deepEqual(readPanelStatusLight({}), { style: "default", position: "default", blink: "default" });
  assert.deepEqual(readPanelStatusLight({ statusLight: { style: "dots", position: "reading", blink: false } }), {
    style: "dots",
    position: "reading",
    blink: false,
  });
});
