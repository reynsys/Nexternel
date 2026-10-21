/** Shared react-grid-layout geometry — single source for placement and responsive sizing. */

export const DASHBOARD_GRID_COLS = 12;

/**
 * Breakpoint names for the aspect-ratio table. Column count stays 12 at every
 * width so saved w/h keep the same fraction of the section. rowHeight tracks
 * column width, which is what stops phone tiles becoming tall strips.
 */
export const DASHBOARD_BREAKPOINTS = {
  xxs: 0,
  xs: 480,
  sm: 768,
  md: 996,
  lg: 1200,
} as const;

export type DashboardBreakpoint = keyof typeof DASHBOARD_BREAKPOINTS;

export const DASHBOARD_COLS_FOR_BREAKPOINT: Record<DashboardBreakpoint, number> = {
  xxs: DASHBOARD_GRID_COLS,
  xs: DASHBOARD_GRID_COLS,
  sm: DASHBOARD_GRID_COLS,
  md: DASHBOARD_GRID_COLS,
  lg: DASHBOARD_GRID_COLS,
};

/** Representative container widths used in the verification table (xxs has no unique min). */
export const DASHBOARD_BREAKPOINT_CONTAINER_WIDTH: Record<DashboardBreakpoint, number> = {
  xxs: 360,
  xs: 480,
  sm: 768,
  md: 996,
  lg: 1200,
};

export const DASHBOARD_GRID_MARGIN_X = 16;
export const DASHBOARD_GRID_MARGIN_Y = 16;

/** Legacy fallback when the section width is not yet measured. */
export const DASHBOARD_ROW_HEIGHT = 56;

/** Narrowest typical section width — conservative minW at accordion/mobile widths. */
export const PLACEMENT_REFERENCE_GRID_WIDTH_PX = 360;

/** Main tile inset: 4px panel padding on the left and right. */
export const TILE_CONTENT_INSET_X_PX = 8;
/** Rough main-tile inset: 4px top, the 30px title strip, 6px between tiles, 4px bottom. */
export const TILE_CONTENT_INSET_Y_PX = 44;

export function dashboardBreakpointForWidth(widthPx: number): DashboardBreakpoint {
  if (widthPx >= DASHBOARD_BREAKPOINTS.lg) return "lg";
  if (widthPx >= DASHBOARD_BREAKPOINTS.md) return "md";
  if (widthPx >= DASHBOARD_BREAKPOINTS.sm) return "sm";
  if (widthPx >= DASHBOARD_BREAKPOINTS.xs) return "xs";
  return "xxs";
}

export function dashboardColsForWidth(widthPx: number): number {
  return DASHBOARD_COLS_FOR_BREAKPOINT[dashboardBreakpointForWidth(widthPx)];
}

/**
 * Column width as used in the aspect-ratio specification:
 * containerWidth / cols. react-grid-layout's own column width also subtracts
 * margins; rowHeight uses this simpler value so w:h in grid units equals the
 * pixel aspect at every breakpoint.
 */
export function dashboardColumnWidthPx(
  containerWidthPx: number,
  cols = DASHBOARD_GRID_COLS
): number {
  if (containerWidthPx <= 0 || cols <= 0) return 0;
  return containerWidthPx / cols;
}

/** Square grid cells: rowHeight equals column width at this container size. */
export function dashboardRowHeightPx(
  containerWidthPx: number,
  cols = DASHBOARD_GRID_COLS
): number {
  return dashboardColumnWidthPx(containerWidthPx, cols);
}

export function rglColumnWidthPx(gridWidthPx: number, cols = DASHBOARD_GRID_COLS): number {
  if (gridWidthPx <= 0 || cols <= 0) return 0;
  return (gridWidthPx + DASHBOARD_GRID_MARGIN_X) / cols - DASHBOARD_GRID_MARGIN_X;
}

export function rglCellHeightPx(
  h: number,
  rowHeight: number,
  marginY = DASHBOARD_GRID_MARGIN_Y
): number {
  if (h <= 0) return 0;
  return h * rowHeight + (h - 1) * marginY;
}

export function rglCellWidthPx(
  w: number,
  gridWidthPx: number,
  cols = DASHBOARD_GRID_COLS,
  marginX = DASHBOARD_GRID_MARGIN_X
): number {
  if (w <= 0 || gridWidthPx <= 0) return 0;
  const colWidth = rglColumnWidthPx(gridWidthPx, cols);
  if (colWidth <= 0) return 0;
  return w * colWidth + (w - 1) * marginX;
}

export function estimateRglH(
  heightPx: number,
  rowHeight: number,
  marginY = DASHBOARD_GRID_MARGIN_Y
): number {
  if (heightPx <= 0) return 0;
  return Math.max(1, Math.round((heightPx + marginY) / (rowHeight + marginY)));
}

export function estimateRglW(
  cellWidthPx: number,
  gridWidthPx: number,
  cols = DASHBOARD_GRID_COLS,
  marginX = DASHBOARD_GRID_MARGIN_X
): number {
  if (cellWidthPx <= 0 || gridWidthPx <= 0) return 0;
  const colWidth = rglColumnWidthPx(gridWidthPx, cols);
  if (colWidth <= 0) return 0;
  return Math.max(1, Math.round((cellWidthPx + marginX) / (colWidth + marginX)));
}

/** Estimated inner content size at grid allocation (reference grid width). */
export function contentSizeAtGridUnits(
  w: number,
  h: number,
  gridWidthPx = PLACEMENT_REFERENCE_GRID_WIDTH_PX
): { width: number; height: number; shortSide: number } {
  const rowHeight = dashboardRowHeightPx(gridWidthPx);
  const outerW = w * dashboardColumnWidthPx(gridWidthPx);
  const outerH = h * rowHeight;
  const width = Math.max(0, outerW - TILE_CONTENT_INSET_X_PX);
  const height = Math.max(0, outerH - TILE_CONTENT_INSET_Y_PX);
  return { width, height, shortSide: Math.min(width, height) };
}

/**
 * KDE model: the grid cell is the container; content adapts to whatever shape
 * the operator leaves after drag/resize. Default w/h below match Rey's ratios
 * on a square-cell grid. Saved layouts are not rewritten.
 *
 * Non-spec shapes (operator resized):
 * - Gauge — the ECharts example is drawn as published.
 * - Chart — ECharts resize() fills the slot; line axes keep default fonts.
 * - Switch / button — semantic controls wrap in the slot (comfortable/compact).
 * - Summary / value — readings use container queries (cqi), not a second scaler.
 * - Clock / calendar / weather / system — composite tiles fill; clock type uses
 *   clamp on cqi; calendar month grid shrinks with the slot.
 * - Camera — tile default is 2:1 (16×9 does not fit integer 12-col cells
 *   together with 1:1 gauges). The stream uses 16:9 object-fit inside the slot.
 */
export const PANEL_ASPECT_DEFAULTS = {
  gauge: { w: 4, h: 4, specW: 1, specH: 1 },
  chart: { w: 8, h: 4, specW: 2, specH: 1 },
  switch: { w: 2, h: 2, specW: 1, specH: 1 },
  button: { w: 2, h: 2, specW: 1, specH: 1 },
  summary: { w: 4, h: 2, specW: 2, specH: 1 },
  clock: { w: 4, h: 4, specW: 1, specH: 1 },
  calendar: { w: 5, h: 7, specW: 1, specH: 1.4 },
  weather: { w: 8, h: 4, specW: 2, specH: 1 },
  /** Grid cell 2:1 so it shares the square-cell math; video inside is 16:9. */
  camera: { w: 8, h: 4, specW: 2, specH: 1 },
  system: { w: 8, h: 4, specW: 2, specH: 1 },
} as const;

export type PanelAspectKind = keyof typeof PANEL_ASPECT_DEFAULTS;

export function specRenderedSize(
  kind: PanelAspectKind,
  containerWidthPx: number,
  cols = DASHBOARD_GRID_COLS
): {
  columnWidth: number;
  rowHeight: number;
  w: number;
  h: number;
  pixelW: number;
  pixelH: number;
  specPixelW: number;
  specPixelH: number;
  shorter: number;
  deltaOnShorter: number;
  pass: boolean;
} {
  const def = PANEL_ASPECT_DEFAULTS[kind];
  const columnWidth = dashboardColumnWidthPx(containerWidthPx, cols);
  const rowHeight = dashboardRowHeightPx(containerWidthPx, cols);
  const pixelW = def.w * columnWidth;
  const pixelH = def.h * rowHeight;
  const specRatio = def.specW / def.specH;
  const specPixelH = pixelW / specRatio;
  const specPixelW = pixelH * specRatio;
  const shorterIsHeight = pixelH <= pixelW;
  const shorter = shorterIsHeight ? pixelH : pixelW;
  const specShorter = shorterIsHeight ? specPixelH : specPixelW;
  const deltaOnShorter = Math.abs(shorter - specShorter);
  return {
    columnWidth,
    rowHeight,
    w: def.w,
    h: def.h,
    pixelW,
    pixelH,
    specPixelW,
    specPixelH,
    shorter,
    deltaOnShorter,
    pass: deltaOnShorter <= 2,
  };
}
