import type { PanelInstance } from "../../api";
import { runtimeConfigToPanelRecord } from "./panel-config";
import type { RuntimePanelInstance } from "./types";
import { serializePanelInstance } from "./serialize-panel";

/**
 * View adapter for contribution/editor renderers that still expect `PanelInstance`.
 * Uses canonical runtime config (no persistence re-decode).
 */
export function runtimePanelToPanelInstance(panel: RuntimePanelInstance): PanelInstance {
  return {
    id: panel.id,
    type: panel.type,
    title: panel.title,
    layout: panel.layout,
    bindings: panel.bindings,
    config: runtimeConfigToPanelRecord(panel.config),
  };
}

/** Serialize runtime panel to the supported persistence wire shape (save / legacy widgets). */
export function toRenderPanel(
  panel: RuntimePanelInstance,
  placement: PanelInstance["layout"] = panel.layout
): PanelInstance {
  return serializePanelInstance(panel, placement);
}
