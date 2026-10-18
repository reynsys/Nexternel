/**
 * Adaptive dashboard layout. A dashboard is arranged on a 12-square-wide grid (the saved
 * `x, y, w, h`). Each screen gets as many readable squares across as fit:
 * - wide enough for the arrangement (laptop and up): shown exactly as arranged, gaps included;
 * - narrower (tablet, phone): panels flow in the arranged order (top-to-bottom, then
 *   left-to-right) into the first free spot, wide panels shrinking to the screen width.
 * The saved data keeps its old meaning, so older versions still read it.
 */
import type { Layout } from "react-grid-layout";

/** Readable square size the column count aims for (px), and the gap between squares. */
export const FLOW_CELL_TARGET_PX = 96;
export const FLOW_CELL_GAP_PX = 12;
export const FLOW_MIN_COLS = 4;
export const FLOW_MAX_COLS = 24;
/** Width of the grid dashboards are arranged on (and saved in). */
export const DESIGN_COLS = 12;

/** Columns for a section width: as many readable squares as fit, an even number, 4–24. */
export function flowColumnsForWidth(widthPx: number): number {
  if (widthPx <= 0) return 12;
  const fit = Math.floor((widthPx + FLOW_CELL_GAP_PX) / (FLOW_CELL_TARGET_PX + FLOW_CELL_GAP_PX));
  const even = fit - (fit % 2);
  return Math.min(FLOW_MAX_COLS, Math.max(FLOW_MIN_COLS, even));
}

export type FlowPanel = {
  i: string;
  /** Saved position — used only for order. */
  x: number;
  y: number;
  /** Saved shape in squares. */
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

/** Panels in display order: saved rows top to bottom, then left to right. */
export function flowOrder<T extends Pick<FlowPanel, "x" | "y">>(panels: readonly T[]): T[] {
  return panels
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x || a.index - b.index)
    .map(({ p }) => p);
}

/** Narrowest panel the grid allows (squares); a gap narrower than this can never be filled. */
export const FLOW_MIN_PANEL_W = 2;

/**
 * Shape on a screen with `cols` squares across.
 * - Wider than the screen: full width, same proportions.
 * - Narrow screens only: when the space left beside the panel is too narrow for any panel
 *   (a 3-wide gauge on a 4-wide phone), it takes the whole row, same proportions.
 *   Otherwise it keeps its shape, so its tiles stay the size of every other panel's.
 * Never shorter than the panel's minimum, or 2 squares.
 */
export function flowShape(panel: FlowPanel, cols: number): { w: number; h: number } {
  const tooWide = panel.w > cols;
  const strandedGap = cols < DESIGN_COLS && panel.w < cols && cols - panel.w < FLOW_MIN_PANEL_W;
  if (!tooWide && !strandedGap) return { w: Math.max(1, panel.w), h: panel.h };
  const w = cols;
  const scaled = Math.round((panel.h * w) / panel.w);
  return { w, h: Math.max(scaled, panel.minH ?? 2, 2) };
}

/** True when every panel sits at its saved place inside `cols` squares without overlapping. */
function savedArrangementFits(panels: readonly FlowPanel[], cols: number): boolean {
  if (cols < DESIGN_COLS) return false;
  const cells = new Set<string>();
  for (const p of panels) {
    if (p.x < 0 || p.y < 0 || p.x + p.w > cols) return false;
    for (let r = p.y; r < p.y + p.h; r++)
      for (let c = p.x; c < p.x + p.w; c++) {
        const key = `${r}:${c}`;
        if (cells.has(key)) return false;
        cells.add(key);
      }
  }
  return true;
}

function withLimits(panel: FlowPanel, cols: number, place: { x: number; y: number; w: number; h: number }): Layout {
  return {
    i: panel.i,
    ...place,
    minW: Math.min(panel.minW ?? 1, cols),
    minH: panel.minH,
    maxW: Math.min(panel.maxW ?? cols, cols),
    maxH: panel.maxH,
  };
}

/** Place panels in order, each at the first spot (top row first, then leftmost) where it fits. */
function packInOrder(panels: readonly FlowPanel[], cols: number): Layout[] {
  const rows: boolean[][] = [];
  const free = (x: number, y: number, w: number, h: number) => {
    for (let r = y; r < y + h; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = x; c < x + w; c++) if (row[c]) return false;
    }
    return true;
  };
  const take = (x: number, y: number, w: number, h: number) => {
    for (let r = y; r < y + h; r++) {
      const row = (rows[r] ??= []);
      for (let c = x; c < x + w; c++) row[c] = true;
    }
  };
  return flowOrder(panels).map((panel) => {
    const { w, h } = flowShape(panel, cols);
    let x = 0;
    let y = 0;
    search: for (y = 0; ; y++) {
      for (x = 0; x + w <= cols; x++) {
        if (free(x, y, w, h)) break search;
      }
    }
    take(x, y, w, h);
    return withLimits(panel, cols, { x, y, w, h });
  });
}

/** Layout for a screen `cols` squares wide (see the module note). */
export function flowLayout(panels: readonly FlowPanel[], cols: number): Layout[] {
  if (savedArrangementFits(panels, cols)) {
    return panels.map((p) => withLimits(p, cols, { x: p.x, y: p.y, w: p.w, h: p.h }));
  }
  return packInOrder(panels, cols);
}

/**
 * What to save after an edit on a screen `cols` squares wide. Shapes stay as saved except
 * the one panel the operator resized.
 * - Wide screen: save positions as the operator left them.
 * - Narrow screen: only the order changed; rebuild the 12-wide arrangement in that order,
 *   so a rearrangement on a phone never turns the laptop layout into a phone layout.
 */
export function flowCommit(
  saved: readonly FlowPanel[],
  edited: readonly Layout[],
  resizedId: string | null,
  cols: number
): Layout[] {
  const byId = new Map(saved.map((p) => [p.i, p]));
  const shaped = edited.map((item) => {
    const original = byId.get(item.i);
    if (!original || item.i === resizedId) return { ...item };
    return { ...item, w: original.w, h: original.h };
  });
  if (cols >= DESIGN_COLS) return shaped;
  const ordered: FlowPanel[] = shaped.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: Math.min(item.w, DESIGN_COLS),
    h: item.h,
    minW: byId.get(item.i)?.minW,
    minH: byId.get(item.i)?.minH,
  }));
  return packInOrder(ordered, DESIGN_COLS);
}

/** Largest square on wide screens (px): fuller use of the width without oversized panels. */
export const FLOW_CELL_MAX_PX = 128;
/**
 * Smallest square at which the 12-wide arrangement is still shown exactly as made (px).
 * Any section about 850 px wide or more qualifies (small desk and wall screens such as
 * 1024 × 768, also with a Look's frame room); only tablets in portrait and phones flow.
 * Text stays readable at this size: dial and chart text has its own minimum (MIN_CHART_FONT).
 */
export const DESIGN_MIN_CELL_PX = 60;

/**
 * Grid geometry for a section `widthPx` wide.
 * Wide enough for 12 squares of at least {@link DESIGN_MIN_CELL_PX}: the arrangement exactly
 * as made, squares grown up to {@link FLOW_CELL_MAX_PX}, left-aligned.
 * Narrower: fewer columns at a readable size, panels flowed in order, full width.
 * `rowHeight` follows the square width (as before), so a laptop looks exactly as it did.
 */
export function flowGridForWidth(widthPx: number): { cols: number; gridWidth: number; rowHeight: number } {
  if (widthPx <= 0) return { cols: DESIGN_COLS, gridWidth: 0, rowHeight: 56 };
  const designCell = (widthPx + FLOW_CELL_GAP_PX) / DESIGN_COLS - FLOW_CELL_GAP_PX;
  if (designCell < DESIGN_MIN_CELL_PX) {
    const cols = Math.min(flowColumnsForWidth(widthPx), DESIGN_COLS - 2);
    return { cols, gridWidth: widthPx, rowHeight: widthPx / cols };
  }
  const cell = Math.min(FLOW_CELL_MAX_PX, designCell);
  const gridWidth = Math.min(widthPx, Math.round(DESIGN_COLS * (cell + FLOW_CELL_GAP_PX) - FLOW_CELL_GAP_PX));
  return { cols: DESIGN_COLS, gridWidth, rowHeight: gridWidth / DESIGN_COLS };
}
