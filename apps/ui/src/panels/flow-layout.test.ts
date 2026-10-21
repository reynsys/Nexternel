import assert from "node:assert/strict";
import test from "node:test";
import {
  rearrangeForColumns, flowColumnsForWidth, flowCommit, flowGridForWidth, flowLayout, type FlowPanel } from "./flow-layout.ts";

const p = (i: string, x: number, y: number, w: number, h: number): FlowPanel => ({ i, x, y, w, h });

// Live dashboards on 10/10/2026 (saved x, y, w, h).
const DASHBOARDS: Record<string, FlowPanel[]> = {
  "DAMN HomE": [
    p("clock", 0, 0, 4, 2), p("calendar", 4, 0, 4, 2), p("weather", 8, 0, 4, 2),
    p("lrTemp", 0, 2, 2, 2), p("lrHum", 2, 2, 2, 2), p("power", 4, 2, 2, 2), p("gas", 6, 2, 2, 2), p("lights", 8, 2, 2, 2),
    p("krTemp", 0, 4, 2, 2), p("krHum", 2, 4, 2, 2), p("hallway", 4, 4, 6, 2),
  ],
  Energy: [p("g1", 0, 0, 3, 3), p("g2", 3, 0, 3, 3), p("g3", 6, 0, 3, 3), p("g4", 9, 0, 3, 3), p("c1", 0, 3, 4, 3), p("c2", 4, 3, 4, 3)],
  "Kids Bedroom": [p("g1", 0, 0, 3, 3), p("g2", 3, 0, 3, 3), p("s1", 6, 0, 2, 2), p("s2", 8, 0, 2, 2), p("c1", 0, 3, 4, 3), p("c2", 4, 3, 4, 3)],
  "Utility Room": [p("g1", 0, 0, 3, 3), p("g2", 3, 0, 3, 3), p("g3", 6, 0, 3, 3), p("big1", 0, 3, 6, 6), p("big2", 6, 3, 6, 6)],
  CCTV: [p("cams", 0, 0, 12, 4)],
};

const pos = (l: { i: string; x: number; y: number; w: number; h: number }[]) =>
  Object.fromEntries(l.map((it) => [it.i, [it.x, it.y, it.w, it.h]]));

test("column count follows the screen: phone 4, tablet 6, laptop 10, 1080p 14, 1440p 20 (16 px gaps)", () => {
  assert.equal(flowColumnsForWidth(316), 4); // phone section width
  assert.equal(flowColumnsForWidth(746), 6); // tablet portrait
  assert.equal(flowColumnsForWidth(850), 6); // tablet landscape
  assert.equal(flowColumnsForWidth(1290), 10); // this laptop
  assert.equal(flowColumnsForWidth(1590), 14); // 1080p desktop
  assert.equal(flowColumnsForWidth(2230), 20); // 1440p screen
  assert.equal(flowColumnsForWidth(9000), 24);
  assert.equal(flowColumnsForWidth(0), 12); // not measured yet
});

test("at 12 columns every live dashboard keeps exactly its current layout", () => {
  for (const [name, panels] of Object.entries(DASHBOARDS)) {
    const laid = pos(flowLayout(panels, 12));
    for (const panel of panels) {
      assert.deepEqual(laid[panel.i], [panel.x, panel.y, panel.w, panel.h], `${name}: ${panel.i}`);
    }
  }
});

test("on a phone (4 columns) wide panels take the full width and keep their shape", () => {
  const laid = pos(flowLayout(DASHBOARDS["DAMN HomE"]!, 4));
  assert.deepEqual(laid.clock, [0, 0, 4, 2]);
  assert.deepEqual(laid.calendar, [0, 2, 4, 2]);
  assert.deepEqual(laid.lrTemp, [0, 6, 2, 2]); // two gauges per row
  assert.deepEqual(laid.lrHum, [2, 6, 2, 2]);
  assert.deepEqual(laid.hallway, [0, 14, 4, 2]); // 6×2 → full width, at least 2 high
  const cctv = pos(flowLayout(DASHBOARDS.CCTV!, 4));
  assert.deepEqual(cctv.cams, [0, 0, 4, 2]); // 12×4 keeps 3:1 → 4×1.3 → 2 high minimum
});

test("nothing overlaps at any width", () => {
  for (const cols of [4, 6, 12, 14, 20]) {
    for (const [name, panels] of Object.entries(DASHBOARDS)) {
      const cells = new Set<string>();
      for (const it of flowLayout(panels, cols)) {
        assert.ok(it.x + it.w <= cols, `${name} @${cols}: ${it.i} past the edge`);
        for (let r = it.y; r < it.y + it.h; r++)
          for (let c = it.x; c < it.x + it.w; c++) {
            const key = `${r}:${c}`;
            assert.ok(!cells.has(key), `${name} @${cols}: ${it.i} overlaps`);
            cells.add(key);
          }
      }
    }
  }
});

test("a wider screen shows the arrangement exactly as made, at the same square size", () => {
  for (const [name, panels] of Object.entries(DASHBOARDS)) {
    const laid = pos(flowLayout(panels, 20));
    for (const panel of panels) assert.deepEqual(laid[panel.i], [panel.x, panel.y, panel.w, panel.h], name);
  }
});

test("on a phone, a panel too wide for two per row takes the whole row", () => {
  const laid = pos(flowLayout(DASHBOARDS["Utility Room"]!, 4));
  assert.deepEqual(laid.g1, [0, 0, 4, 4]); // 3×3 gauge → 4×4, not 3×3 beside an empty strip
  assert.deepEqual(laid.big1, [0, 12, 4, 4]); // 6×6 → 4×4
});

test("a 1280 px monitor (8 columns): Hallway Monitor keeps its 6×2 shape, so its tiles match the gauges", () => {
  const laid = pos(flowLayout(DASHBOARDS["DAMN HomE"]!, 8));
  assert.deepEqual(laid.hallway.slice(2), [6, 2]); // not stretched to 8×3
  assert.deepEqual(laid.lrTemp.slice(2), [2, 2]);
});

test("a tablet (6 columns) flows in order and fills rows", () => {
  const laid = flowLayout(DASHBOARDS["Kids Bedroom"]!, 6);
  assert.deepEqual(laid.map((l) => l.i), ["g1", "g2", "s1", "s2", "c1", "c2"]);
  assert.deepEqual(pos(laid).g2, [3, 0, 3, 3]);
  assert.deepEqual(pos(laid).s1, [0, 3, 2, 2]);
});

test("rearranging on a phone changes only the order; the laptop layout is rebuilt 12 wide", () => {
  const saved = DASHBOARDS["DAMN HomE"]!;
  const onPhone = flowLayout(saved, 4);
  // Drag Hallway Monitor to the very top on the phone.
  const dragged = onPhone.map((l) => (l.i === "hallway" ? { ...l, x: 0, y: -1 } : l));
  const commit = pos(flowCommit(saved, dragged, null, 4));
  assert.deepEqual(commit.hallway, [0, 0, 6, 2]); // first, at its saved 6×2 shape, 12-wide grid
  assert.deepEqual(commit.clock, [6, 0, 4, 2]);
  for (const [, , w] of Object.values(commit)) assert.ok(w <= 12);
});

test("a resize changes only that panel's shape; on a wide screen positions are kept", () => {
  const saved = DASHBOARDS["DAMN HomE"]!;
  const laptop = flowLayout(saved, 12);
  const resized = laptop.map((l) => (l.i === "gas" ? { ...l, w: 3, h: 3 } : l));
  const commit = pos(flowCommit(saved, resized, "gas", 12));
  assert.deepEqual(commit.gas, [6, 2, 3, 3]);
  assert.deepEqual(commit.hallway, [4, 4, 6, 2]);
});

test("grid geometry: laptops keep their layout exactly, wide screens grow squares to a limit, narrow screens flow", () => {
  // This laptop's real section width (measured on the live dashboard at 1600 px).
  const laptop = flowGridForWidth(1278);
  assert.deepEqual([laptop.cols, laptop.gridWidth, laptop.rowHeight], [12, 1278, 106.5]); // = before (width / 12)
  for (const w of [848, 950, 996, 1100, 1366 - 300, 1590]) {
    const g = flowGridForWidth(w);
    assert.deepEqual([g.cols, g.gridWidth, g.rowHeight], [12, w, w / 12], `width ${w}`);
  }
  const qhd = flowGridForWidth(2230);
  assert.equal(qhd.cols, 12);
  assert.equal(qhd.gridWidth, 12 * (128 + 16) - 16); // capped at 128 px squares, 16 px gaps
  assert.equal(flowGridForWidth(847).cols, 6); // just under (tablet landscape): flows
  assert.deepEqual([flowGridForWidth(316).cols, flowGridForWidth(316).gridWidth], [4, 316]); // phone
});

test("fewer panels across: bigger squares, the same overall width limit, and the arrangement repacked in order", () => {
  const g10 = flowGridForWidth(1278, 10);
  assert.equal(g10.cols, 10);
  assert.equal(g10.rowHeight, 1278 / 10); // bigger squares than at 12 columns
  assert.equal(flowGridForWidth(2230, 10).gridWidth, flowGridForWidth(2230, 12).gridWidth);
  const panels = [
    { i: "a", x: 0, y: 0, w: 2, h: 2 }, { i: "b", x: 2, y: 0, w: 2, h: 2 }, { i: "c", x: 4, y: 0, w: 2, h: 2 },
    { i: "d", x: 6, y: 0, w: 2, h: 2 }, { i: "e", x: 8, y: 0, w: 2, h: 2 }, { i: "f", x: 10, y: 0, w: 2, h: 2 },
    { i: "wide", x: 0, y: 2, w: 12, h: 2 },
  ];
  const five = pos(rearrangeForColumns(panels, 10));
  assert.deepEqual(five.e, [8, 0, 2, 2]); // five across
  assert.deepEqual(five.f, [0, 2, 2, 2]); // the sixth starts the next row
  assert.deepEqual(five.wide, [0, 4, 10, 2]); // narrowed to the new width
});
