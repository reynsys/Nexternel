/** Platform responsive short-side bands (px) — shared by placement and content degradation. */

export const RESPONSIVE_SHORT_SIDE = {
  summaryMax: 96,
  compactMax: 168,
  comfortableMin: 169,
} as const;

export type MeaningfulResponsiveFloor = "summary" | "compact" | "comfortable";

export function minContentShortSidePx(floor: MeaningfulResponsiveFloor): number {
  switch (floor) {
    case "summary":
      return RESPONSIVE_SHORT_SIDE.summaryMax;
    case "compact":
      return RESPONSIVE_SHORT_SIDE.compactMax;
    case "comfortable":
      return RESPONSIVE_SHORT_SIDE.comfortableMin;
  }
}
