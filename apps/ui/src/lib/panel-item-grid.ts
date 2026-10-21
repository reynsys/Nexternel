import type { SxProps, Theme } from "@mui/material/styles";
import type { PanelAppearanceLayout, PanelItemDirection } from "./panel-appearance";

export type { PanelAppearanceLayout };

/** Row height policy for multi-item panel grids. */
export type PanelItemGridRowSize = "fluid" | "compact" | "standard" | "tall";

const MIN_COL: Record<PanelAppearanceLayout, string> = {
  compact: "7rem",
  grid: "8rem",
  card: "9rem",
};

const MAX_COLS: Record<PanelAppearanceLayout, number> = {
  compact: 2,
  card: 3,
  grid: 4,
};

const ROW_MIN: Record<PanelItemGridRowSize, string> = {
  fluid: "0",
  compact: "4rem",
  standard: "4.5rem",
  tall: "5rem",
};

/**
 * Column count follows how many items exist (capped by layout), not how wide the tile is.
 * One switch → one full-width column; four switches → up to layout max columns.
 */
export function panelItemGridColumns(
  layout: PanelAppearanceLayout = "card",
  itemCount: number,
  direction: PanelItemDirection = "across"
): string {
  if (itemCount <= 0 || direction === "down") return "minmax(0, 1fr)";
  const cols = Math.min(Math.max(1, itemCount), MAX_COLS[layout]);
  return `repeat(${cols}, minmax(0, 1fr))`;
}

/** Gap between item tiles — the same 8px as between the title strip and the tiles. */
export function panelItemGridGap(_layout: PanelAppearanceLayout = "card"): string {
  return "8px";
}

export function panelItemGridSx(opts: {
  layout?: PanelAppearanceLayout;
  direction?: PanelItemDirection;
  rowSize?: PanelItemGridRowSize;
  itemCount: number;
}): SxProps<Theme> {
  const layout = opts.layout ?? "card";
  const direction = opts.direction ?? "across";
  const rowSize = opts.rowSize ?? "standard";
  const cols = direction === "down" ? 1 : Math.min(Math.max(1, opts.itemCount), MAX_COLS[layout]);
  // One row of items fills the panel at whatever height the panel has (half-height panels too);
  // the row minimum only matters when several rows share the panel and may need to scroll.
  const rowMin = Math.ceil(Math.max(1, opts.itemCount) / cols) <= 1 ? "0" : ROW_MIN[rowSize];
  const base: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "grid",
    gridTemplateColumns: panelItemGridColumns(layout, opts.itemCount, direction),
    gridAutoRows: rowMin === "0" ? "minmax(0, 1fr)" : `minmax(${rowMin}, 1fr)`,
    gap: panelItemGridGap(layout),
    overflow: "auto",
    alignContent: "stretch",
    alignItems: "stretch",
    "& > *": {
      minWidth: 0,
      minHeight: 0,
      width: "100%",
      height: "100%",
    },
  };
  if (cols >= 3) {
    (base as Record<string, unknown>)["@container (max-width: 20rem)"] = {
      gridTemplateColumns: `repeat(${Math.min(2, cols)}, minmax(0, 1fr))`,
    };
  }
  if (cols >= 2) {
    (base as Record<string, unknown>)["@container (max-width: 11rem)"] = {
      gridTemplateColumns: "minmax(0, 1fr)",
    };
  }
  return base;
}

/** @deprecated used only for docs — min column width reference */
export const PANEL_ITEM_MIN_COL = MIN_COL;

/** Smallest readable reading/switch tile, including its name line (px). */
export const ITEM_TILE_MIN_WIDTH_PX = 112;
export const ITEM_TILE_MIN_HEIGHT_PX = 84;
const ITEM_TILE_GAP_PX = 8;
const ITEM_GRID_PADDING_PX = 0;

/**
 * Whether `count` tiles fit the panel's content box at a readable size.
 * When they do not, the panel shows a list instead of shrinking or dropping items.
 */
export function itemTilesFit(opts: {
  count: number;
  width: number;
  height: number;
  direction?: PanelItemDirection;
}): boolean {
  const { count, width, height, direction = "across" } = opts;
  if (count <= 1) return true;
  if (width <= 0 || height <= 0) return true; // not measured yet
  const innerW = width - ITEM_GRID_PADDING_PX;
  const innerH = height - ITEM_GRID_PADDING_PX;
  const maxCols =
    direction === "down"
      ? 1
      : Math.max(1, Math.floor((innerW + ITEM_TILE_GAP_PX) / (ITEM_TILE_MIN_WIDTH_PX + ITEM_TILE_GAP_PX)));
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);
  const needH = rows * ITEM_TILE_MIN_HEIGHT_PX + (rows - 1) * ITEM_TILE_GAP_PX;
  return needH <= innerH;
}
