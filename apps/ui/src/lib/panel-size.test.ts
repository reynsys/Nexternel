import assert from "node:assert/strict";
import test from "node:test";
import {
  measurePanelContentSize,
  panelContentSizeChanged,
  isPanelContentSizeReady,
} from "./panel-size.js";

test("measurePanelContentSize floors dimensions", () => {
  const el = {
    getBoundingClientRect: () => ({
      width: 219.7,
      height: 240.2,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as HTMLElement;
  assert.deepEqual(measurePanelContentSize(el), { width: 219, height: 240 });
});

test("panelContentSizeChanged detects width and height changes", () => {
  assert.equal(
    panelContentSizeChanged({ width: 100, height: 100 }, { width: 100, height: 100 }),
    false
  );
  assert.equal(
    panelContentSizeChanged({ width: 100, height: 100 }, { width: 101, height: 100 }),
    true
  );
  assert.equal(
    panelContentSizeChanged({ width: 100, height: 100 }, { width: 100, height: 99 }),
    true
  );
});

test("isPanelContentSizeReady requires positive dimensions", () => {
  assert.equal(isPanelContentSizeReady({ width: 0, height: 0 }), false);
  assert.equal(isPanelContentSizeReady({ width: 1, height: 1 }), true);
});
