import type { PanelInstance } from "../../api";
import { normalizePanelConfig } from "../../lib/panel-compatibility/panel-config";
import type { MigratedPanelConfig, PanelDescriptor } from "./types";

/**
 * Deterministic configuration migration for a registered Panel type.
 * Unknown fields are preserved via the compatibility layer.
 */
export function migratePanelConfiguration(
  _descriptor: PanelDescriptor | null,
  panelInstance: PanelInstance
): MigratedPanelConfig {
  const normalized = normalizePanelConfig(panelInstance);
  return {
    schemaVersion: normalized.schemaVersion,
    data: normalized.data,
    preservedFields: normalized.preservedFields,
    errors: [],
  };
}

export function configSchemaSupported(
  descriptor: PanelDescriptor | null,
  schemaVersion: number
): boolean {
  if (!descriptor) return false;
  return schemaVersion <= descriptor.configSchemaVersion;
}
