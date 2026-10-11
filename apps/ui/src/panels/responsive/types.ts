import type { PanelResponsiveState } from "../registry/types";

export type { PanelResponsiveState };

/** Platform responsive context supplied by PanelHost (LAW 016). */
export type PanelResponsiveContextValue = {
  state: PanelResponsiveState;
  /**
   * Measured content width in px — PanelHost/platform only.
   * Panel implementations must use `usePanelResponsiveSemanticState()` instead.
   */
  contentWidth: number;
  /**
   * Measured content height in px — PanelHost/platform only.
   * Panel implementations must use `usePanelResponsiveSemanticState()` instead.
   */
  contentHeight: number;
};

export const DEFAULT_RESPONSIVE_CONTEXT: PanelResponsiveContextValue = {
  state: "comfortable",
  contentWidth: 0,
  contentHeight: 0,
};
