import assert from "node:assert/strict";
import test from "node:test";
import {
  STEPS, arrangeInRows, currentPanelsPerRow, panelsPerRowChoices,
  rearrangeForColumns, flowColumnsForWidth, flowCommit, flowGridForWidth, flowLayout, flowShape, picturesAcross, type FlowPanel } from "./flow-layout.ts";

// The grid counts widths in steps (six to a square). These tests are written in squares:
// `p` and `pos` convert, and `sq(n)` is n squares across. D is the older 12-square arrangement.
const sq = (n: number) => n * STEPS;
const D = sq(12);
const p = (i: string, x: number, y: number, w: number, h: number): FlowPanel => ({ i, x: sq(x), y, w: sq(w), h });

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
  Object.fromEntries(l.map((it) => [it.i, [it.x / STEPS, it.y, it.w / STEPS, it.h]]));

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
    const laid = pos(flowLayout(panels, sq(12), D));
    for (const panel of panels) {
      assert.deepEqual(laid[panel.i], [panel.x / STEPS, panel.y, panel.w / STEPS, panel.h], `${name}: ${panel.i}`);
    }
  }
});

test("on a phone (4 columns) wide panels take the full width and keep their shape", () => {
  const laid = pos(flowLayout(DASHBOARDS["DAMN HomE"]!, sq(4), D));
  assert.deepEqual(laid.clock, [0, 0, 4, 2]);
  assert.deepEqual(laid.calendar, [0, 2, 4, 2]);
  assert.deepEqual(laid.lrTemp, [0, 6, 2, 2]); // two gauges per row
  assert.deepEqual(laid.lrHum, [2, 6, 2, 2]);
  assert.deepEqual(laid.hallway, [0, 14, 4, 2]); // 6×2 → full width, at least 2 high
  const cctv = pos(flowLayout(DASHBOARDS.CCTV!, sq(4), D));
  assert.deepEqual(cctv.cams, [0, 0, 4, 2]); // 12×4 keeps 3:1 → 4×1.3 → 2 high minimum
});

test("nothing overlaps at any width", () => {
  for (const cols of [4, 6, 12, 14, 20]) {
    for (const [name, panels] of Object.entries(DASHBOARDS)) {
      const cells = new Set<string>();
      for (const it of flowLayout(panels, sq(cols), D)) {
        assert.ok(it.x + it.w <= sq(cols), `${name} @${cols}: ${it.i} past the edge`);
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
    const laid = pos(flowLayout(panels, sq(20), D));
    for (const panel of panels) assert.deepEqual(laid[panel.i], [panel.x / STEPS, panel.y, panel.w / STEPS, panel.h], name);
  }
});

test("on a phone, a panel too wide for two per row takes the whole row", () => {
  const laid = pos(flowLayout(DASHBOARDS["Utility Room"]!, sq(4), D));
  assert.deepEqual(laid.g1, [0, 0, 4, 4]); // 3×3 gauge → 4×4, not 3×3 beside an empty strip
  assert.deepEqual(laid.big1, [0, 12, 4, 4]); // 6×6 → 4×4
});

test("on a phone, gauges take half the row (two side by side) instead of the whole row", () => {
  const gauges = DASHBOARDS.Energy!.map((panel) => (panel.i.startsWith("g") ? { ...panel, compact: true } : panel));
  const laid = pos(flowLayout(gauges, sq(4), D));
  assert.deepEqual(laid.g1, [0, 0, 2, 2]); // 3×3 gauge → 2×2, same proportions
  assert.deepEqual(laid.g2, [2, 0, 2, 2]);
  assert.deepEqual(laid.g3, [0, 2, 2, 2]);
  assert.deepEqual(laid.c1, [0, 4, 4, 3]); // charts still take the whole row
  // A gauge exactly as wide as the phone (the live Kids Bedroom ring, 4 squares) is half width too.
  const kids = [{ ...p("ring", 3, 0, 4, 3), compact: true }, p("chart", 0, 3, 4, 3)];
  assert.deepEqual(pos(flowLayout(kids, sq(4), D)).ring, [0, 0, 2, 2]);
  assert.deepEqual(pos(flowLayout(kids, sq(4), D)).chart, [0, 2, 4, 3]);
  // Wide screens are unchanged: the arrangement is shown exactly as made.
  assert.deepEqual(pos(flowLayout(gauges, D, D)).g1, [0, 0, 3, 3]);
});

test("a 1280 px monitor (8 columns): Hallway Monitor keeps its 6×2 shape, so its tiles match the gauges", () => {
  const laid = pos(flowLayout(DASHBOARDS["DAMN HomE"]!, sq(8), D));
  assert.deepEqual(laid.hallway.slice(2), [6, 2]); // not stretched to 8×3
  assert.deepEqual(laid.lrTemp.slice(2), [2, 2]);
});

test("a tablet (6 columns) flows in order and fills rows", () => {
  const laid = flowLayout(DASHBOARDS["Kids Bedroom"]!, sq(6), D);
  assert.deepEqual(laid.map((l) => l.i), ["g1", "g2", "s1", "s2", "c1", "c2"]);
  assert.deepEqual(pos(laid).g2, [3, 0, 3, 3]);
  assert.deepEqual(pos(laid).s1, [0, 3, 2, 2]);
});

test("rearranging on a phone changes only the order; the laptop layout is rebuilt 12 wide", () => {
  const saved = DASHBOARDS["DAMN HomE"]!;
  const onPhone = flowLayout(saved, sq(4), D);
  // Drag Hallway Monitor to the very top on the phone.
  const dragged = onPhone.map((l) => (l.i === "hallway" ? { ...l, x: 0, y: -1 } : l));
  const commit = pos(flowCommit(saved, dragged, null, sq(4), D));
  assert.deepEqual(commit.hallway, [0, 0, 6, 2]); // first, at its saved 6×2 shape, 12-wide grid
  assert.deepEqual(commit.clock, [6, 0, 4, 2]);
  for (const [, , w] of Object.values(commit)) assert.ok(w <= 12);
});

test("a resize changes only that panel's shape; on a wide screen positions are kept", () => {
  const saved = DASHBOARDS["DAMN HomE"]!;
  const laptop = flowLayout(saved, sq(12), D);
  const resized = laptop.map((l) => (l.i === "gas" ? { ...l, w: sq(3), h: 3 } : l));
  const commit = pos(flowCommit(saved, resized, "gas", sq(12), D));
  assert.deepEqual(commit.gas, [6, 2, 3, 3]);
  assert.deepEqual(commit.hallway, [4, 4, 6, 2]);
});

test("grid geometry: laptops keep their layout exactly, wider sections fill their width, narrow screens flow", () => {
  // This laptop's real section width (measured on the live dashboard at 1600 px).
  const laptop = flowGridForWidth(1278, D);
  assert.deepEqual([laptop.cols, laptop.gridWidth, laptop.rowHeight], [sq(12), 1278, 106.5]); // = before (width / 12)
  for (const w of [848, 950, 996, 1100, 1366 - 300, 1590]) {
    const g = flowGridForWidth(w, D);
    assert.deepEqual([g.cols, g.gridWidth, g.rowHeight], [sq(12), w, w / 12], `width ${w}`);
  }
  const qhd = flowGridForWidth(2230, D);
  assert.equal(qhd.cols, sq(12));
  // Panels fill the section; the dashboard itself stops at DASHBOARD_MAX_WIDTH_PX and is centred (DashboardPage).
  assert.deepEqual([qhd.gridWidth, qhd.rowHeight], [2230, 2230 / 12]);
  assert.equal(flowGridForWidth(847, D).cols, sq(10)); // just under (tablet landscape): flows, two squares fewer
  assert.deepEqual([flowGridForWidth(316, D).cols, flowGridForWidth(316, D).gridWidth], [sq(4), 316]); // phone
});

test("fewer panels across: bigger squares, the same overall width, and the arrangement repacked in order", () => {
  const g10 = flowGridForWidth(1278, sq(10));
  assert.equal(g10.cols, sq(10));
  assert.equal(g10.rowHeight, 1278 / 10); // bigger squares than at 12 across
  assert.equal(flowGridForWidth(2230, sq(10)).gridWidth, flowGridForWidth(2230, D).gridWidth);
  const panels = [
    p("a", 0, 0, 2, 2), p("b", 2, 0, 2, 2), p("c", 4, 0, 2, 2),
    p("d", 6, 0, 2, 2), p("e", 8, 0, 2, 2), p("f", 10, 0, 2, 2),
    p("wide", 0, 2, 12, 2),
  ];
  const five = pos(rearrangeForColumns(panels, sq(10)));
  assert.deepEqual(five.e, [8, 0, 2, 2]); // five across
  assert.deepEqual(five.f, [0, 2, 2, 2]); // the sixth starts the next row
  assert.deepEqual(five.wide, [0, 4, 10, 2]); // narrowed to the new width
});

test("rows are never shorter than the Look's panel frame and title need", () => {
  const phone = flowGridForWidth(358, D);
  assert.equal(flowGridForWidth(358, D, 88).rowHeight, Math.max(phone.rowHeight, 88));
  // A wide screen's rows are already taller: the minimum changes nothing there.
  assert.equal(flowGridForWidth(1278, sq(10), 88).rowHeight, flowGridForWidth(1278, sq(10)).rowHeight);
});

test("a dashboard 5 across is 60 steps: one step is a sixth of a square, the square size is unchanged", () => {
  const g = flowGridForWidth(1278); // default: 5 across
  assert.equal(g.cols, 60);
  assert.equal(g.rowHeight, 1278 / 10);
  assert.equal(flowGridForWidth(316).cols, sq(4)); // a phone still flows 4 squares across
});

test("an upright tablet keeps squares about the size of a laptop's, not one huge panel per row", () => {
  const g = flowGridForWidth(752); // 800 wide tablet, inside the dashboard frame
  assert.equal(g.cols, sq(8));
  assert.ok(g.rowHeight < 100, `square ${g.rowHeight}`);
  // A screen just too narrow for the arrangement loses two squares, not half of them.
  assert.equal(flowGridForWidth(800).cols, sq(8));
  // Phones are unchanged: 4 squares across.
  assert.equal(flowGridForWidth(380).cols, sq(4));
});

test("panels per row: 60 steps split into 2, 3, 4, 5 or 6; 48 steps (4 across) into 2, 3, 4 or 6", () => {
  assert.deepEqual(panelsPerRowChoices(60), [2, 3, 4, 5, 6]);
  assert.deepEqual(panelsPerRowChoices(48), [2, 3, 4, 6]);
});

test("panels per row: the live Energy dashboard, 3 to a row, fills each row exactly, heights kept", () => {
  // Energy on 01/11/2026 (10 squares across): three 3-wide gauges left a 1-square gap.
  const energy = [p("g1", 0, 0, 3, 3), p("g2", 3, 0, 3, 3), p("g3", 6, 0, 3, 3), p("c1", 0, 3, 3, 3), p("c2", 3, 3, 4, 3), p("c3", 0, 6, 4, 3)];
  const rows = arrangeInRows(energy, 3, 60);
  assert.deepEqual(rows.map((l) => [l.i, l.x, l.y, l.w, l.h]), [
    ["g1", 0, 0, 20, 3], ["g2", 20, 0, 20, 3], ["g3", 40, 0, 20, 3],
    ["c1", 0, 3, 20, 3], ["c2", 20, 3, 20, 3], ["c3", 40, 3, 20, 3],
  ]);
  assert.equal(currentPanelsPerRow(rows, 60), 3);
  assert.equal(currentPanelsPerRow(energy, 60), null); // mixed widths: no choice shown as picked
  const five = arrangeInRows(energy, 5, 60);
  assert.deepEqual(five.map((l) => [l.x, l.w]).slice(0, 5), [[0, 12], [12, 12], [24, 12], [36, 12], [48, 12]]);
  assert.deepEqual([five[5]!.x, five[5]!.y], [0, 3]);
});

test("a panel of cameras puts them under each other on a phone and grows to hold them", () => {
  const cctv = { i: "cctv", x: 0, y: 0, w: 60, h: 4, pictures: { count: 3, across: 3, aspect: 16 / 9 } };
  const phone = flowShape(cctv, 24);
  assert.equal(phone.w, 24);
  assert.equal(picturesAcross(cctv.pictures, phone.w), 1);
  // Three 16:9 pictures 4 squares wide need about 2.25 squares each, plus names and the title.
  assert.ok(phone.h >= 8 && phone.h <= 10, `h=${phone.h}`);
  // A tablet upright: also 4 squares across, but each about 190 px: two side by side.
  const tablet = flowShape(cctv, 24, undefined, 190);
  assert.equal(picturesAcross(cctv.pictures, tablet.w, 190), 2);
  assert.ok(tablet.h < phone.h, "two rows need less height than three");
  // A phone with real square sizes (about 90 px): one at a time.
  assert.equal(picturesAcross(cctv.pictures, 24, 90), 1);
  // As arranged on a wide screen: unchanged.
  assert.deepEqual(flowShape(cctv, 60), { w: 60, h: 4 });
  // Without pictures, the old proportional rule.
  assert.deepEqual(flowShape({ i: "x", x: 0, y: 0, w: 60, h: 4 }, 24), { w: 24, h: 2 });
});
