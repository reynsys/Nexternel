import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sectionGridSource = readFileSync(
  fileURLToPath(new URL("../components/SectionGrid.tsx", import.meta.url)),
  "utf8"
);

test("the grid only takes a new layout when it really changed (no render loop)", () => {
  const start = sectionGridSource.indexOf("useLayoutEffect(() => {");
  const end = sectionGridSource.indexOf("}, [flowed]);", start);
  const effect = sectionGridSource.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const guard = effect.indexOf("if (gridLayoutsEqual(gridLayoutRef.current, flowed)) return;");
  const setter = effect.indexOf("setGridLayout(flowed)");
  assert.ok(guard >= 0 && setter > guard, "setGridLayout must stay behind the equality guard");
});

test("layout is saved only when a drag or resize ends", () => {
  const gridStart = sectionGridSource.indexOf("<GridLayout");
  const grid = sectionGridSource.slice(gridStart, sectionGridSource.indexOf("</GridLayout>", gridStart));
  assert.match(grid, /onDragStop=\{\(next\) => commitLayout\(next, null\)\}/);
  assert.match(grid, /onResizeStop=\{\(next, _old, item\) => commitLayout\(next, item\.i\)\}/);
  assert.doesNotMatch(grid, /onResize=|onDrag=/);
});

test("RGL does not wire onLayoutChange (fires on every controlled layout update)", () => {
  const gridStart = sectionGridSource.indexOf("<GridLayout");
  const gridEnd = sectionGridSource.indexOf("</GridLayout>", gridStart);
  const grid = sectionGridSource.slice(gridStart, gridEnd);

  assert.ok(gridStart >= 0 && gridEnd > gridStart);
  assert.doesNotMatch(grid, /onLayoutChange=\{commitLayout\}/);
});
