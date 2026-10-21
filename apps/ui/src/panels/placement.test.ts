import assert from "node:assert/strict";
import test from "node:test";
import {
  clampLayoutToPanelLimits,
  enforcePanelPlacement,
  gridLayoutsEqual,
  layoutForPersistence,
  panelItemPlacementFloor,
  panelPlacementLimits,
  panelSectionLayoutMatches,
} from "./placement.ts";
import { bootstrapV5PanelRegistry } from "./registry/bootstrap.ts";

test.before(() => {
  bootstrapV5PanelRegistry();
});

test("panel.charts uses 4x2 intrinsic minimum (legacy catalog minW/minH do not apply)", () => {
  const limits = panelPlacementLimits("panel.charts");
  assert.equal(limits.minW, 4);
  assert.equal(limits.minH, 2);
  assert.ok(limits.minW < 6, "charts must be resizable below legacy 6-column floor");
});

test("clampLayoutToPanelLimits enforces platform minimum during resize", () => {
  const clamped = clampLayoutToPanelLimits("panel.controls", {
    i: "p1",
    x: 0,
    y: 0,
    w: 1,
    h: 1,
  });
  assert.equal(clamped.w, 2);
  assert.equal(clamped.h, 1); // switches may be half height
});

test("enforcePanelPlacement upgrades legacy persisted mins", () => {
  const panel = enforcePanelPlacement({
    id: "chart-1",
    type: "panel.charts",
    layout: {
      i: "chart-1",
      x: 0,
      y: 0,
      w: 8,
      h: 5,
      minW: 6,
      minH: 4,
    },
    bindings: {},
    config: {},
  });
  assert.equal(panel.layout.minW, 4);
  assert.equal(panel.layout.minH, 2);
});

test("enforcePanelPlacement keeps a 2x2 gauge at the platform floor", () => {
  const panel = enforcePanelPlacement({
    id: "g1",
    type: "panel.gauge",
    layout: {
      i: "g1",
      x: 0,
      y: 0,
      w: 2,
      h: 2,
      minW: 2,
      minH: 2,
    },
    bindings: {},
    config: {},
  });
  assert.equal(panel.layout.w, 2);
  assert.equal(panel.layout.h, 2);
  assert.equal(panel.layout.minW, 2);
  assert.equal(panel.layout.minH, 2);
});

test("gridLayoutsEqual ignores minW/minH constraint fields", () => {
  const a = [{ i: "p1", x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 }];
  const b = [{ i: "p1", x: 0, y: 0, w: 4, h: 3, minW: 3, minH: 4 }];
  assert.equal(gridLayoutsEqual(a, b), true);
});

test("panelSectionLayoutMatches compares persisted panel layout", () => {
  const panels = [
    {
      id: "p1",
      type: "panel.system",
      layout: { i: "p1", x: 0, y: 0, w: 4, h: 3 },
      bindings: {},
      config: {},
    },
  ];
  const same = [{ i: "p1", x: 0, y: 0, w: 4, h: 3 }];
  const moved = [{ i: "p1", x: 0, y: 1, w: 4, h: 3 }];
  assert.equal(panelSectionLayoutMatches(panels, same), true);
  assert.equal(panelSectionLayoutMatches(panels, moved), false);
});

test("one status reading may be half height (2x1)", () => {
  const floor = panelItemPlacementFloor({
    id: "s1",
    type: "panel.status",
    layout: { i: "s1", x: 0, y: 0, w: 4, h: 2 },
    config: { panelScope: { contentMode: "manual", capabilityIds: ["co2"] } },
  });
  assert.deepEqual(floor, { minW: 2, minH: 1 });
});

test("several status readings cannot shrink below one half-height cell each", () => {
  const across = enforcePanelPlacement({
    id: "s2",
    type: "panel.status",
    layout: { i: "s2", x: 0, y: 0, w: 2, h: 2 },
    bindings: {},
    config: {
      panelScope: { contentMode: "manual", capabilityIds: ["a", "b"] },
      appearance: { direction: "across" },
    },
  });
  assert.equal(across.layout.w, 4);
  assert.equal(across.layout.h, 2);
  const down = enforcePanelPlacement({
    id: "s3",
    type: "panel.status",
    layout: { i: "s3", x: 0, y: 0, w: 2, h: 2 },
    bindings: {},
    config: {
      panelScope: { contentMode: "manual", capabilityIds: ["a", "b", "c"] },
      appearance: { direction: "down" },
    },
  });
  assert.equal(down.layout.w, 2);
  assert.equal(down.layout.h, 3); // three readings stacked: one half-height row each
});

test("layout persistence strips derived min/max fields", () => {
  const persisted = layoutForPersistence({
    id: "g1",
    type: "panel.controls",
    layout: { i: "g1", x: 0, y: 0, w: 3, h: 4, minW: 2, minH: 2 },
    config: {},
  });
  assert.deepEqual(persisted, { i: "g1", x: 0, y: 0, w: 3, h: 4 });
});
