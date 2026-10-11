import assert from "node:assert/strict";
import test from "node:test";
import {
  isVisualizationRectReady,
  measureVisualizationRect,
  visualizationRectChanged,
} from "./visualization-rect.ts";

function mockElement(width: number, height: number): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
}

test("measureVisualizationRect floors dimensions", () => {
  assert.deepEqual(measureVisualizationRect(mockElement(271.9, 126.2)), {
    width: 271,
    height: 126,
  });
});

test("visualizationRectChanged detects width and height changes", () => {
  assert.equal(
    visualizationRectChanged({ width: 100, height: 50 }, { width: 100, height: 50 }),
    false
  );
  assert.equal(
    visualizationRectChanged({ width: 100, height: 50 }, { width: 99, height: 50 }),
    true
  );
  assert.equal(
    visualizationRectChanged({ width: 100, height: 50 }, { width: 100, height: 51 }),
    true
  );
});

test("isVisualizationRectReady requires positive dimensions", () => {
  assert.equal(isVisualizationRectReady({ width: 0, height: 0 }), false);
  assert.equal(isVisualizationRectReady({ width: 0, height: 100 }), false);
  assert.equal(isVisualizationRectReady({ width: 100, height: 0 }), false);
  assert.equal(isVisualizationRectReady({ width: 1, height: 1 }), true);
});

test("zero dimensions are stable and do not force spurious change detection", () => {
  const zero = { width: 0, height: 0 };
  assert.equal(visualizationRectChanged(zero, zero), false);
  assert.equal(isVisualizationRectReady(zero), false);
});
