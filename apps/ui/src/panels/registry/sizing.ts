import type { PanelLayoutSize } from "@nexternel/domain";
import {
  DASHBOARD_GRID_COLS,
  resolvePlacementMinimum,
  type PlacementGridSize,
} from "./placement-contract";
import type { PanelRendererClass, PanelSizingContract } from "./types";

export {
  DASHBOARD_GRID_COLS,
  PLATFORM_PLACEMENT_MIN_H,
  PLATFORM_PLACEMENT_MIN_W,
} from "./placement-contract";

/** Build the V5 Panel sizing + placement contract for registry descriptors. */
export function buildPanelSizingContract(opts: {
  preferredWidth: number;
  preferredHeight: number;
  rendererClass: PanelRendererClass;
  intrinsicMinimum?: PlacementGridSize | null;
}): PanelSizingContract {
  const mins = resolvePlacementMinimum(opts.rendererClass, opts.intrinsicMinimum);
  const preferredWidth = Math.max(mins.w, opts.preferredWidth);
  const preferredHeight = Math.max(mins.h, opts.preferredHeight);
  return {
    preferredWidth,
    preferredHeight,
    minWidth: mins.w,
    minHeight: mins.h,
    maxWidth: DASHBOARD_GRID_COLS,
    preferredAspectRatio: preferredWidth / preferredHeight,
    heightPolicy: "fill",
    degradationModes: ["comfortable", "compact", "summary", "insufficient"],
  };
}

/** Core registry entry — preferred size from domain catalog; mins from placement contract. */
export function sizingFromCoreDefinition(
  defaultSize: PanelLayoutSize,
  rendererClass: PanelRendererClass
): PanelSizingContract {
  return buildPanelSizingContract({
    preferredWidth: defaultSize.w,
    preferredHeight: defaultSize.h,
    rendererClass,
  });
}

/** Contribution / ECharts panels — preferred from defaultSize; mins from renderer class. */
export function sizingFromContribution(
  defaultSize: { w: number; h: number } | undefined,
  rendererClass: PanelRendererClass
): PanelSizingContract {
  return buildPanelSizingContract({
    preferredWidth: defaultSize?.w ?? 4,
    preferredHeight: defaultSize?.h ?? 3,
    rendererClass,
  });
}

