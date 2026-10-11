import type { SxProps, Theme } from "@mui/material/styles";
import type { PanelResponsiveState } from "./types";

/**
 * Generic semantic Panel root styles — container-oriented degradation (LAW 016, LAW 031).
 * Uses semantic responsive state + CSS container queries; not per-capability rules.
 */
export function semanticPanelRootSx(_state: PanelResponsiveState): SxProps<Theme> {
  return {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    "&[data-responsive-state='compact']": {
      "& .nx-semantic-label": { fontSize: "0.7rem" },
      "& .nx-semantic-area-line": { display: "none" },
    },
    "&[data-responsive-state='summary']": {
      "& .nx-semantic-label": { display: "none" },
      "& .nx-semantic-area-line": { display: "none" },
    },
    "@container (max-width: 140px)": {
      "& .nx-semantic-label": { fontSize: "0.68rem" },
    },
    "@container (max-width: 96px)": {
      "& .nx-semantic-label": { display: "none" },
    },
  };
}

/** Grid gap scaled by semantic responsive state. */
export function semanticGridGap(state: PanelResponsiveState): number {
  if (state === "compact" || state === "summary") return 0.75;
  return 1.25;
}
