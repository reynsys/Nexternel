import type { PanelRendererClass } from "./types";

export const DASHBOARD_GRID_COLS = 12;

/** Platform floor — renderers must degrade below this; no per-renderer placement catalogue. */
export const PLATFORM_PLACEMENT_MIN_W = 2;
/**
 * Height floor: one square, so small panels (switches, single readings, status lists) can be
 * half the height of a standard panel. Panels that need more say so by class (below).
 */
export const PLATFORM_PLACEMENT_MIN_H = 1;

export type PlacementGridSize = { w: number; h: number };

/**
 * Intrinsic placement floor by renderer class.
 * Square cells (rowHeight = columnWidth): gauges stay square, down to the
 * platform floor of 2×2. Charts stay 2:1.
 * Enforced on load via enforcePanelPlacement as a floor, not a rewrite of larger saved tiles.
 */
export function intrinsicPlacementMinimum(rendererClass: PanelRendererClass): PlacementGridSize | null {
  if (rendererClass === "radial-gauge") {
    return { w: 2, h: 2 };
  }
  if (rendererClass === "time-series-chart" || rendererClass === "chart-canvas") {
    return { w: 4, h: 2 };
  }
  if (rendererClass === "live-media" || rendererClass === "composite-tile") {
    return { w: 2, h: 2 };
  }
  return null;
}

export function resolvePlacementMinimum(
  rendererClass: PanelRendererClass,
  explicit?: PlacementGridSize | null
): PlacementGridSize {
  const fromClass = intrinsicPlacementMinimum(rendererClass);
  return {
    w: Math.max(
      PLATFORM_PLACEMENT_MIN_W,
      fromClass?.w ?? PLATFORM_PLACEMENT_MIN_W,
      explicit?.w ?? PLATFORM_PLACEMENT_MIN_W
    ),
    h: Math.max(
      PLATFORM_PLACEMENT_MIN_H,
      fromClass?.h ?? PLATFORM_PLACEMENT_MIN_H,
      explicit?.h ?? PLATFORM_PLACEMENT_MIN_H
    ),
  };
}
