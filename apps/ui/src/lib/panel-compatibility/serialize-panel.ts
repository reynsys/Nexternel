import { normalizePanelBindings } from "@nexternel/domain";
import type { PanelInstance } from "../../api";
import { panelScopeToPersistedConfig } from "./panel-config";
import type { NormalizedPanelInstance } from "./types";

type Placement = PanelInstance["layout"];

/**
 * Serialize a normalized Panel back to the current supported persistence shape.
 * Unknown types and preserved fields round-trip without loss.
 */
export function serializePanelInstance(
  panel: NormalizedPanelInstance,
  placement: Placement
): PanelInstance {
  const persistedType =
    panel.compatibility.availability === "unknown"
      ? panel.compatibility.sourceType
      : panel.type;

  const config = panelScopeToPersistedConfig(
    panel.config,
    panel.compatibility.legacyScopeSource
  );

  return {
    id: panel.id,
    type: persistedType,
    title: panel.title,
    layout: placement,
    bindings: normalizePanelBindings(panel.bindings),
    config,
  };
}
