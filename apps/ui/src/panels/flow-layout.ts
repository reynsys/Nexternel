/**
 * Adaptive dashboard layout. A dashboard is arranged 10 (or 8) squares wide; the saved `x` and `w`
 * are in steps, six to a square (60 or 48 across), `y` and `h` in squares. Every `cols` and
 * `design` below counts steps. Each screen gets as many readable squares across as fit:
 * - wide enough for the arrangement (laptop and up): shown exactly as arranged, gaps included;
 * - narrower (tablet, phone): panels flow in the arranged order (top-to-bottom, then
 *   left-to-right) into the first free spot, wide panels shrinking to the screen width.
 * The saved data keeps its old meaning, so older versions still read it.
 */
import type { Layout } from "react-grid-layout";
import { GRID_STEPS_PER_SQUARE } from "@nexternel/domain";

/** Steps in a square. */
export const STEPS = GRID_STEPS_PER_SQUARE;

/** Readable square size the column count aims for (px), and the gap between squares. */
export const FLOW_CELL_TARGET_PX = 96;
export const FLOW_CELL_GAP_PX = 16;
export const FLOW_MIN_COLS = 4;
export const FLOW_MAX_COLS = 24;
/** Squares the square-size limits are measured against (dashboards used to be 12 squares wide). */
export const REFERENCE_SQUARES = 12;
/** Width of the grid dashboards are arranged on (and saved in), in steps: 5 standard panels across. */
export const DESIGN_COLS = 10 * STEPS;

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
  /** Items shown as pictures (cameras): how many, how many side by side as arranged, their shape. */
  pictures?: PanelPictures;
  /**
   * The content is one drawing that reads well small (a gauge): on a narrow screen it takes half
   * the row instead of the whole row, so two sit side by side.
   */
  compact?: boolean;
};

/** What a panel of pictures told the dashboard about its items (see PanelItemGrid). */
export type PanelPictures = {
  count: number;
  /** Side by side as arranged. */
  across: number;
  /** Width over height of one picture (16/9 for a camera). */
  aspect: number;
};

/** Narrowest a picture is allowed before it goes under the one beside it (px; 3 squares when the size is unknown). */
export const PICTURE_MIN_PX = 260;
export const PICTURE_MIN_W = 3 * STEPS;
/** Room for a panel's title row and for each item's name line, in squares. */
const PANEL_TITLE_SQUARES = 0.7;
const ITEM_NAME_SQUARES = 0.45;

/**
 * How many pictures sit side by side in a panel `w` steps wide: as arranged, fewer when too narrow.
 * `squarePx` is one square on this screen (phones and tablets have very different squares).
 */
export function picturesAcross(pictures: PanelPictures, w: number, squarePx?: number): number {
  const fit = squarePx && squarePx > 0 ? Math.floor(((w / STEPS) * squarePx) / PICTURE_MIN_PX) : Math.floor(w / PICTURE_MIN_W);
  return Math.max(1, Math.min(pictures.across, pictures.count, fit));
}

/** Panels in display order: saved rows top to bottom, then left to right. */
export function flowOrder<T extends Pick<FlowPanel, "x" | "y">>(panels: readonly T[]): T[] {
  return panels
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p.y - b.p.y || a.p.x - b.p.x || a.index - b.index)
    .map(({ p }) => p);
}

/** Narrowest panel the grid allows (2 squares, in steps); a gap narrower than this can never be filled. */
export const FLOW_MIN_PANEL_W = 2 * STEPS;

/**
 * Shape on a screen with `cols` steps across.
 * - Wider than the screen: full width, same proportions. A panel of pictures (cameras) instead
 *   puts its pictures under each other at their own shape, and grows to hold them.
 * - Narrow screens only: when the space left beside the panel is too narrow for any panel
 *   (a 3-wide chart on a 4-wide phone), it takes the whole row, same proportions. A compact
 *   panel (a gauge) takes half the row instead, so two sit side by side.
 *   Otherwise it keeps its shape, so its tiles stay the size of every other panel's.
 * Never shorter than the panel's minimum, or 2 squares.
 */
export function flowShape(panel: FlowPanel, cols: number, design = DESIGN_COLS, squarePx?: number): { w: number; h: number } {
  const tooWide = panel.w > cols;
  const strandedGap = cols < design && panel.w < cols && cols - panel.w < FLOW_MIN_PANEL_W;
  if (!tooWide && !strandedGap) return { w: Math.max(1, panel.w), h: panel.h };
  const half = Math.floor(cols / 2 / STEPS) * STEPS;
  if (panel.compact && cols < design && half >= FLOW_MIN_PANEL_W && half >= (panel.minW ?? 1) && half < panel.w) {
    // Half the row, same proportions: two gauges side by side instead of one the whole screen wide.
    return { w: half, h: Math.max(Math.round((panel.h * half) / panel.w), panel.minH ?? 1, 2) };
  }
  const w = cols;
  if (panel.pictures && panel.pictures.count > 0) {
    // Pictures go under each other instead of shrinking, at their own shape: the panel grows to hold them.
    const across = picturesAcross(panel.pictures, w, squarePx);
    const rows = Math.ceil(panel.pictures.count / across);
    const pictureH = w / STEPS / across / panel.pictures.aspect;
    const needed = Math.ceil(PANEL_TITLE_SQUARES + rows * (pictureH + ITEM_NAME_SQUARES));
    return { w, h: Math.max(needed, panel.minH ?? 1, 2) };
  }
  const scaled = Math.round((panel.h * w) / panel.w);
  // Squeezed onto a narrow screen: never lower than it was, up to 2 squares (a half-height panel stays half height).
  return { w, h: Math.max(scaled, panel.minH ?? 1, Math.min(panel.h, 2)) };
}

/** True when every panel sits at its saved place inside `cols` steps without overlapping. */
function savedArrangementFits(panels: readonly FlowPanel[], cols: number, design = DESIGN_COLS): boolean {
  if (cols < design) return false;
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
function packInOrder(panels: readonly FlowPanel[], cols: number, design = DESIGN_COLS, squarePx?: number): Layout[] {
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
    const { w, h } = flowShape(panel, cols, design, squarePx);
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

/** Layout for a screen `cols` steps wide (see the module note). */
export function flowLayout(panels: readonly FlowPanel[], cols: number, design = DESIGN_COLS, squarePx?: number): Layout[] {
  if (savedArrangementFits(panels, cols, design)) {
    return panels.map((p) => withLimits(p, cols, { x: p.x, y: p.y, w: p.w, h: p.h }));
  }
  return packInOrder(panels, cols, design, squarePx);
}

/**
 * A dashboard's arrangement for a new number of columns (panels across): same order and
 * shapes, wide panels narrowed to the new width, packed from the top left.
 */
export function rearrangeForColumns(panels: readonly FlowPanel[], cols: number): Layout[] {
  return packInOrder(
    panels.map((p) => ({ ...p, w: Math.min(p.w, cols) })),
    cols,
    cols
  );
}

/** Panels in a row choices for a dashboard `cols` steps wide: the counts that split it evenly. */
export function panelsPerRowChoices(cols: number): number[] {
  return [2, 3, 4, 5, 6].filter((n) => cols % n === 0);
}

/** How many panels per row a section already has when all are one even width; otherwise null. */
export function currentPanelsPerRow(panels: readonly Pick<FlowPanel, "w">[], cols: number): number | null {
  const widths = new Set(panels.map((p) => p.w));
  if (widths.size !== 1) return null;
  const w = panels[0]!.w;
  return cols % w === 0 && panelsPerRowChoices(cols).includes(cols / w) ? cols / w : null;
}

/** Every panel the same width, `perRow` to a row, in their order; heights are kept. */
export function arrangeInRows(panels: readonly FlowPanel[], perRow: number, cols: number): Layout[] {
  const w = Math.floor(cols / perRow);
  return packInOrder(
    panels.map((p) => ({ ...p, w })),
    cols,
    cols
  );
}

/**
 * What to save after an edit on a screen `cols` steps wide. Shapes stay as saved except
 * the one panel the operator resized.
 * - Wide screen: save positions as the operator left them.
 * - Narrow screen: only the order changed; rebuild the full-width arrangement in that order,
 *   so a rearrangement on a phone never turns the laptop layout into a phone layout.
 */
export function flowCommit(
  saved: readonly FlowPanel[],
  edited: readonly Layout[],
  resizedId: string | null,
  cols: number,
  design = DESIGN_COLS
): Layout[] {
  const byId = new Map(saved.map((p) => [p.i, p]));
  const shaped = edited.map((item) => {
    const original = byId.get(item.i);
    if (!original || item.i === resizedId) return { ...item };
    return { ...item, w: original.w, h: original.h };
  });
  if (cols >= design) return shaped;
  const ordered: FlowPanel[] = shaped.map((item) => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: Math.min(item.w, design),
    h: item.h,
    minW: byId.get(item.i)?.minW,
    minH: byId.get(item.i)?.minH,
  }));
  return packInOrder(ordered, design, design);
}

/** Largest square on wide screens (px): fuller use of the width without oversized panels. */
export const FLOW_CELL_MAX_PX = 128;
/**
 * Smallest square at which the arrangement is still shown exactly as made (px, for 12 squares across;
 * fewer squares across need proportionally bigger ones).
 * Any section about 850 px wide or more qualifies (small desk and wall screens such as
 * 1024 × 768, also with a Look's frame room); only tablets in portrait and phones flow.
 * Text stays readable at this size: dial and chart text has its own minimum (MIN_CHART_FONT).
 */
export const DESIGN_MIN_CELL_PX = 56;

/**
 * Grid geometry for a section `widthPx` wide, `design` steps across; `cols` comes back in steps.
 * Wide enough for its squares at {@link DESIGN_MIN_CELL_PX}: the arrangement exactly
 * as made, squares grown up to {@link FLOW_CELL_MAX_PX}, left-aligned.
 * Narrower: fewer squares, each still at least that size (an even number, at least 4), panels flowed
 * in order, full width.
 * `rowHeight` is one square (heights are counted in squares).
 */
export function flowGridForWidth(
  widthPx: number,
  design = DESIGN_COLS,
  /** The least a row may be (the Look's panel frame and title row plus room for content). */
  minRowPx = 0
): { cols: number; gridWidth: number; rowHeight: number } {
  const g = flowGridForWidthOnly(widthPx, design);
  return { ...g, rowHeight: Math.max(g.rowHeight, minRowPx) };
}

function flowGridForWidthOnly(widthPx: number, design: number): { cols: number; gridWidth: number; rowHeight: number } {
  if (widthPx <= 0) return { cols: design, gridWidth: 0, rowHeight: 56 };
  const squares = design / STEPS;
  // Fewer squares = bigger squares; the limits keep the same overall width as 12 squares would.
  const k = REFERENCE_SQUARES / squares;
  const designCell = (widthPx + FLOW_CELL_GAP_PX) / squares - FLOW_CELL_GAP_PX;
  if (designCell < DESIGN_MIN_CELL_PX * k) {
    // As many squares as fit at the same readable size the arrangement itself needs, so a screen
    // just too narrow for it loses a square or two, not half of them (an upright tablet used to get
    // 4 squares of about 190 px: every panel the full width and huge).
    const fit = Math.floor((widthPx + FLOW_CELL_GAP_PX) / (DESIGN_MIN_CELL_PX * k + FLOW_CELL_GAP_PX));
    const across = Math.min(Math.max(FLOW_MIN_COLS, fit - (fit % 2)), squares - 2);
    return { cols: across * STEPS, gridWidth: widthPx, rowHeight: widthPx / across };
  }
  const maxGrid = REFERENCE_SQUARES * (FLOW_CELL_MAX_PX + FLOW_CELL_GAP_PX) - FLOW_CELL_GAP_PX;
  const cell = Math.min((maxGrid + FLOW_CELL_GAP_PX) / squares - FLOW_CELL_GAP_PX, designCell);
  const gridWidth = Math.min(widthPx, Math.round(squares * (cell + FLOW_CELL_GAP_PX) - FLOW_CELL_GAP_PX));
  return { cols: design, gridWidth, rowHeight: gridWidth / squares };
}
