import assert from "node:assert/strict";
import test from "node:test";
import {
  measureVisualizationRect,
  visualizationRectChanged,
} from "./visualization-rect.ts";
import { measurePanelContentSize, panelContentSizeChanged } from "./panel-size.ts";

/**
 * Documents the panel vs visualization rectangle relationship.
 * Chrome height is consumed from the panel content box, not calculated by the platform.
 */
test("panel chrome reduces available visualization slot height", () => {
  const panelEl = {
    getBoundingClientRect: () => ({
      width: 271,
      height: 152,
      top: 0,
      left: 0,
      right: 271,
      bottom: 152,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as HTMLElement;

  const slotEl = {
    getBoundingClientRect: () => ({
      width: 271,
      height: 126,
      top: 26,
      left: 0,
      right: 271,
      bottom: 152,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  } as HTMLElement;

  const panel = measurePanelContentSize(panelEl);
  const slot = measureVisualizationRect(slotEl);

  assert.deepEqual(panel, { width: 271, height: 152 });
  assert.deepEqual(slot, { width: 271, height: 126 });
  assert.ok(slot.height < panel.height);
  assert.equal(panel.width, slot.width);
});

test("independent measurement contexts do not cross-update", () => {
  const panel = { width: 271, height: 152 };
  const slot = { width: 271, height: 126 };
  assert.equal(panelContentSizeChanged(panel, panel), false);
  assert.equal(visualizationRectChanged(slot, slot), false);
  assert.equal(panelContentSizeChanged(panel, { width: 272, height: 152 }), true);
  assert.equal(visualizationRectChanged(slot, { width: 271, height: 127 }), true);
});
