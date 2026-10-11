import type { PanelContentSize } from "../../lib/panel-size";
import type { PanelSizingContract } from "../registry/types";
import type { PanelResponsiveState } from "./types";
import { RESPONSIVE_SHORT_SIDE } from "./thresholds";

const STATE_ORDER: PanelResponsiveState[] = [
  "comfortable",
  "compact",
  "summary",
  "insufficient",
];

/** Below this content short-side (px) the panel has no meaningful presentation area. */
const INSUFFICIENT_SHORT_SIDE_PX = 40;

function rawResponsiveState(size: PanelContentSize, _sizing: PanelSizingContract): PanelResponsiveState {
  const width = size.width;
  const height = size.height;

  if (width <= 0 || height <= 0) return "comfortable";

  const shortSide = Math.min(width, height);
  if (shortSide < INSUFFICIENT_SHORT_SIDE_PX) return "insufficient";
  if (shortSide < RESPONSIVE_SHORT_SIDE.summaryMax) return "summary";
  if (shortSide < RESPONSIVE_SHORT_SIDE.compactMax) return "compact";
  if (shortSide >= RESPONSIVE_SHORT_SIDE.comfortableMin) return "comfortable";
  return "compact";
}

/** Pick nearest allowed degradation mode when contract restricts states. */
export function clampResponsiveState(
  state: PanelResponsiveState,
  allowed: readonly PanelResponsiveState[]
): PanelResponsiveState {
  if (allowed.length === 0) return state;
  if (allowed.includes(state)) return state;

  const stateIdx = STATE_ORDER.indexOf(state);
  let best = allowed[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const mode of allowed) {
    const distance = Math.abs(STATE_ORDER.indexOf(mode) - stateIdx);
    if (distance < bestDistance) {
      best = mode;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Resolve semantic responsive state from measured content size.
 * Independent of dashboard grid placement mins — renderers degrade inside the tile.
 */
export function resolvePanelResponsiveState(
  size: PanelContentSize,
  sizing: PanelSizingContract
): PanelResponsiveState {
  const allowed =
    sizing.degradationModes && sizing.degradationModes.length > 0
      ? sizing.degradationModes
      : STATE_ORDER;
  const raw = rawResponsiveState(size, sizing);
  return clampResponsiveState(raw, allowed);
}
