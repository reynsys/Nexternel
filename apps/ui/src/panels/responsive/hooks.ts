import { usePanelResponsiveState } from "./PanelResponsiveContext";
import type { PanelResponsiveState } from "./types";

/**
 * Semantic-only responsive contract for Panel implementations (LAW 016).
 * Ordinary composers must not depend on raw measured dimensions.
 */
export function usePanelResponsiveSemanticState(): { state: PanelResponsiveState } {
  const { state } = usePanelResponsiveState();
  return { state };
}
