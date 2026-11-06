import assert from "node:assert/strict";
import test from "node:test";
import { DOCK_MIN_TILE, DOCK_TILE, dockFit } from "./dock-fit.ts";

const widthUsed = (f: { size: number; columns: number }, tools: number, gap: number) => (f.columns + tools) * f.size + (f.columns + tools) * gap;

test("rooms keep their full size while they fit", () => {
  assert.deepEqual(dockFit(1000, 10, 1, 8), { size: DOCK_TILE, columns: 10 });
});

test("rooms shrink evenly before anything else happens", () => {
  const f = dockFit(520, 10, 1, 8);
  assert.equal(f.columns, 10);
  assert.ok(f.size < DOCK_TILE && f.size >= DOCK_MIN_TILE);
  assert.ok(widthUsed(f, 1, 8) <= 520);
});

test("rooms too small to press take two rows, and every room still fits", () => {
  const f = dockFit(320, 10, 1, 8);
  assert.equal(f.columns, 5);
  assert.ok(widthUsed(f, 1, 8) <= 320);
});

test("however narrow or however many, no room leaves the dock", () => {
  for (const width of [300, 360, 420, 520, 640, 800]) {
    for (const rooms of [2, 6, 10, 14]) {
      const f = dockFit(width, rooms, 1, 8);
      assert.ok(f.size >= DOCK_MIN_TILE, `${width}/${rooms}`);
      assert.ok(f.columns * Math.ceil(rooms / f.columns) >= rooms);
    }
  }
});
