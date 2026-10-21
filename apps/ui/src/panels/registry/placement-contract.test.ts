import assert from "node:assert/strict";
import test from "node:test";
import { PANEL_RENDERER_CLASSES } from "./types";
import {
  PLATFORM_PLACEMENT_MIN_H,
  PLATFORM_PLACEMENT_MIN_W,
  intrinsicPlacementMinimum,
  resolvePlacementMinimum,
} from "./placement-contract";

test("platform minimum is 2 wide × 1 high (small panels may be half height)", () => {
  assert.equal(PLATFORM_PLACEMENT_MIN_W, 2);
  assert.equal(PLATFORM_PLACEMENT_MIN_H, 1);
});

test("gauges, cameras and composite tiles stay at 2x2; charts at 4x2; readings and controls may be 2x1", () => {
  assert.deepEqual(intrinsicPlacementMinimum("radial-gauge"), { w: 2, h: 2 });
  assert.deepEqual(intrinsicPlacementMinimum("time-series-chart"), { w: 4, h: 2 });
  assert.deepEqual(intrinsicPlacementMinimum("chart-canvas"), { w: 4, h: 2 });
  for (const rendererClass of PANEL_RENDERER_CLASSES) {
    const mins = resolvePlacementMinimum(rendererClass);
    if (rendererClass === "radial-gauge" || rendererClass === "live-media" || rendererClass === "composite-tile") {
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
      assert.equal(mins.h, 1);
    }
  }
});
