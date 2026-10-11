import assert from "node:assert/strict";
import test from "node:test";
import {
  DASHBOARD_BREAKPOINT_CONTAINER_WIDTH,
  DASHBOARD_COLS_FOR_BREAKPOINT,
  PANEL_ASPECT_DEFAULTS,
  specRenderedSize,
  type DashboardBreakpoint,
  type PanelAspectKind,
} from "./grid-geometry.ts";

const BREAKPOINTS = Object.keys(
  DASHBOARD_BREAKPOINT_CONTAINER_WIDTH
) as DashboardBreakpoint[];
const KINDS = Object.keys(PANEL_ASPECT_DEFAULTS) as PanelAspectKind[];

test("default w/h match spec aspect on a square-cell grid", () => {
  for (const kind of KINDS) {
    const def = PANEL_ASPECT_DEFAULTS[kind];
    const gridRatio = def.w / def.h;
    const specRatio = def.specW / def.specH;
    assert.ok(
      Math.abs(gridRatio - specRatio) < 1e-9,
      `${kind}: w/h ${gridRatio} !== spec ${specRatio}`
    );
  }
});

test("every panel type matches spec within 2px on the shorter side at every breakpoint", () => {
  const failures: string[] = [];
  for (const bp of BREAKPOINTS) {
    const containerWidth = DASHBOARD_BREAKPOINT_CONTAINER_WIDTH[bp];
    const cols = DASHBOARD_COLS_FOR_BREAKPOINT[bp];
    for (const kind of KINDS) {
      const row = specRenderedSize(kind, containerWidth, cols);
      const line = [
        kind,
        bp,
        `container=${containerWidth}`,
        `cols=${cols}`,
        `colW=${row.columnWidth.toFixed(2)}`,
        `rowH=${row.rowHeight.toFixed(2)}`,
        `wh=${row.w}x${row.h}`,
        `px=${row.pixelW.toFixed(1)}x${row.pixelH.toFixed(1)}`,
        `ratio=${(row.pixelW / row.pixelH).toFixed(4)}`,
        `spec=${PANEL_ASPECT_DEFAULTS[kind].specW}:${PANEL_ASPECT_DEFAULTS[kind].specH}`,
        `Δshort=${row.deltaOnShorter.toFixed(2)}`,
        row.pass ? "PASS" : "FAIL",
      ].join(" | ");
      if (!row.pass) failures.push(line);
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});
