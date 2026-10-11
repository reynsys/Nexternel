import assert from "node:assert/strict";
import test from "node:test";
import { PANEL_RENDERER_CLASSES } from "./types";
import {
  PLATFORM_PLACEMENT_MIN_H,
  PLATFORM_PLACEMENT_MIN_W,
  intrinsicPlacementMinimum,
  resolvePlacementMinimum,
} from "./placement-contract";

test("platform generic minimum is 2x2", () => {
  assert.equal(PLATFORM_PLACEMENT_MIN_W, 2);
  assert.equal(PLATFORM_PLACEMENT_MIN_H, 2);
});

test("gauges stay square at the 2x2 floor; charts stay 2:1 at 4x2; other classes stay 2x2", () => {
  assert.deepEqual(intrinsicPlacementMinimum("radial-gauge"), { w: 2, h: 2 });
  assert.deepEqual(intrinsicPlacementMinimum("time-series-chart"), { w: 4, h: 2 });
  assert.deepEqual(intrinsicPlacementMinimum("chart-canvas"), { w: 4, h: 2 });
  for (const rendererClass of PANEL_RENDERER_CLASSES) {
    const mins = resolvePlacementMinimum(rendererClass);
    if (rendererClass === "radial-gauge") {
      assert.equal(mins.w, 2);
      assert.equal(mins.h, 2);
    } else if (
      rendererClass === "time-series-chart" ||
      rendererClass === "chart-canvas"
    ) {
      assert.equal(mins.w, 4);
      assert.equal(mins.h, 2);
    } else {
      assert.equal(intrinsicPlacementMinimum(rendererClass), null);
      assert.equal(mins.w, 2);
      assert.equal(mins.h, 2);
    }
  }
});
