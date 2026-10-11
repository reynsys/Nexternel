import { normalizePanelBindings } from "@nexternel/domain";
import type { PanelInstance } from "../../api";
import { normalizePanelConfig } from "./panel-config";
import { runtimePanelToPanelInstance } from "./render-adapter";
import { migratePanelType } from "./panel-type";
import type { NormalizedPanelInstance, RuntimePanelInstance } from "./types";

function readBindings(panelInstance: PanelInstance): Record<string, unknown> {
  return normalizePanelBindings(panelInstance.bindings);
}

/**
 * Normalize one persisted panel record into the logical Panel instance model.
 * Idempotent for already-normalized instances.
 */
export function normalizePanelInstance(panelInstance: PanelInstance): NormalizedPanelInstance {
  const id =
    typeof panelInstance.id === "string" && panelInstance.id.trim()
      ? panelInstance.id.trim()
      : "";
  const migratedType = migratePanelType(panelInstance.type);
  const normalizedConfig = normalizePanelConfig(panelInstance);
  const { legacyScopeSource, ...config } = normalizedConfig;

  return {
    id,
    type: migratedType.type,
    title: typeof panelInstance.title === "string" ? panelInstance.title : undefined,
    bindings: readBindings(panelInstance),
    config,
    compatibility: {
      sourceType: migratedType.sourceType,
      availability: migratedType.availability,
      legacyScopeSource,
      typeMigrated: migratedType.typeMigrated,
    },
  };
}

/** Decode one persisted panel (with placement) into the canonical runtime model. */
export function decodePanelInstance(placed: PanelInstance): RuntimePanelInstance {
  const normalized = normalizePanelInstance(placed);
  return {
    ...normalized,
    layout: placed.layout,
  };
}

export function isRuntimePanelInstance(
  panel: PanelInstance | RuntimePanelInstance
): panel is RuntimePanelInstance {
  const config = (panel as RuntimePanelInstance).config;
  return (
    Boolean(config) &&
    typeof config === "object" &&
    "scope" in config &&
    "data" in config &&
    "schemaVersion" in config &&
    "compatibility" in panel
  );
}

export function ensureRuntimePanel(
  panel: PanelInstance | RuntimePanelInstance
): RuntimePanelInstance {
  if (isRuntimePanelInstance(panel)) return panel;
  return decodePanelInstance(panel);
}

export function mergeRuntimePanelPatch(
  panel: RuntimePanelInstance,
  patch: Partial<PanelInstance>
): RuntimePanelInstance {
  const base = runtimePanelToPanelInstance(panel);
  return decodePanelInstance({
    ...base,
    ...patch,
    layout: patch.layout ?? panel.layout,
    bindings: patch.bindings ?? panel.bindings,
    config: (patch.config ?? base.config) as Record<string, unknown>,
  });
}
