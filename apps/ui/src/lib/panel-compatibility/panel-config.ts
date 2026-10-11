import type { PanelInstance } from "../../api";
import { migrateEchartsWidget } from "./panel-type";
import {
  isScopeConfigKey,
  normalizePanelScope,
  normalizedScopeFromRecord,
  scopeConfigFromNormalized,
} from "./panel-scope";
import type { NormalizedPanelConfig } from "./types";
import { PANEL_CONFIG_SCHEMA_VERSION } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Undo runtime-config leaks. Until V5.2.68 the panel editors were given the runtime panel,
 * so a save wrote `{ ...runtimeConfig, panelScope, appearance }` and every later save nested
 * the previous config one level deeper under `data`. Flatten those layers; the outermost
 * (newest) value of a field wins.
 */
function flattenLeakedRuntimeLayers(record: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(record.data) || !("preservedFields" in record)) return { ...record };
  const { scope: _scope, data, preservedFields, schemaVersion: _version, ...own } = record;
  return {
    ...flattenLeakedRuntimeLayers(data as Record<string, unknown>),
    ...(isRecord(preservedFields) ? preservedFields : {}),
    ...own,
  };
}

/** A saved config that carries runtime keys next to its own `panelScope` / `viewScope`. */
export function hasLeakedRuntimeLayers(config: unknown): boolean {
  return (
    isRecord(config) &&
    isRecord(config.data) &&
    "preservedFields" in config &&
    (isRecord(config.panelScope) || isRecord(config.viewScope))
  );
}

function readConfigRecord(panelInstance: PanelInstance): Record<string, unknown> {
  if (!isRecord(panelInstance.config)) return {};
  const record = hasLeakedRuntimeLayers(panelInstance.config)
    ? flattenLeakedRuntimeLayers(panelInstance.config)
    : { ...panelInstance.config };
  // A saved `panelScope` / `viewScope` is what editors write; a `scope` beside it is a stale
  // copy from the same leak, not panel data.
  if ((isRecord(record.panelScope) || isRecord(record.viewScope)) && "scope" in record) {
    delete record.scope;
  }
  return record;
}

function migrateConfigData(
  data: Record<string, unknown>,
  schemaVersion: number
): Record<string, unknown> {
  if (schemaVersion >= PANEL_CONFIG_SCHEMA_VERSION) return data;
  const next = { ...data };
  if (typeof next.gaugeStyle === "string" && !next.presetId) {
    const style = next.gaugeStyle;
    const legacyPreset: Record<string, string> = {
      thermometer: "gauge-temperature",
      ring: "gauge",
      dial: "gauge",
      progress: "gauge-progress",
    };
    next.presetId = legacyPreset[style] ?? "gauge";
  }
  return next;
}

export type NormalizedPanelConfigResult = NormalizedPanelConfig & {
  legacyScopeSource: "panelScope" | "viewScope" | null;
};

function isCanonicalRuntimeConfig(rawConfig: Record<string, unknown>): boolean {
  const scope = rawConfig.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  return !(
    (rawConfig.panelScope && typeof rawConfig.panelScope === "object") ||
    (rawConfig.viewScope && typeof rawConfig.viewScope === "object")
  );
}

function normalizeCanonicalRuntimeConfig(
  rawConfig: Record<string, unknown>
): NormalizedPanelConfigResult {
  const scope = normalizedScopeFromRecord(rawConfig.scope as Record<string, unknown>);
  const schemaVersion =
    typeof rawConfig.configSchemaVersion === "number" &&
    Number.isFinite(rawConfig.configSchemaVersion)
      ? rawConfig.configSchemaVersion
      : PANEL_CONFIG_SCHEMA_VERSION;

  const data: Record<string, unknown> = {};
  const preservedFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawConfig)) {
    if (
      key === "scope" ||
      key === "panelScope" ||
      key === "viewScope" ||
      key === "configSchemaVersion"
    ) {
      continue;
    }
    if (isScopeConfigKey(key)) continue;
    data[key] = value;
  }

  const legacyScopeSource =
    rawConfig.viewScope !== undefined && rawConfig.viewScope !== null
      ? "viewScope"
      : null;

  return {
    schemaVersion,
    scope,
    data: migrateConfigData(data, schemaVersion),
    preservedFields,
    legacyScopeSource,
  };
}

export function runtimeConfigToPanelRecord(config: NormalizedPanelConfig): Record<string, unknown> {
  return {
    configSchemaVersion: config.schemaVersion,
    scope: scopeConfigFromNormalized(config.scope),
    ...config.data,
    ...config.preservedFields,
  };
}

export function normalizePanelConfig(panelInstance: PanelInstance): NormalizedPanelConfigResult {
  const migratedPanel = migrateEchartsWidget(panelInstance);
  const rawConfig = readConfigRecord(migratedPanel);
  if (isCanonicalRuntimeConfig(rawConfig)) {
    return normalizeCanonicalRuntimeConfig(rawConfig);
  }
  const { scope, legacyScopeSource } = normalizePanelScope(rawConfig);

  const schemaVersion =
    typeof rawConfig.configSchemaVersion === "number" &&
    Number.isFinite(rawConfig.configSchemaVersion)
      ? rawConfig.configSchemaVersion
      : 0;

  const data: Record<string, unknown> = {};
  const preservedFields: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawConfig)) {
    if (key === "panelScope" || key === "viewScope" || key === "configSchemaVersion") {
      continue;
    }
    if (isScopeConfigKey(key)) continue;
    data[key] = value;
  }

  const migratedData = migrateConfigData(data, schemaVersion);

  if (legacyScopeSource === "viewScope" && rawConfig.viewScope) {
    preservedFields.viewScope = rawConfig.viewScope;
  }

  return {
    schemaVersion: PANEL_CONFIG_SCHEMA_VERSION,
    scope,
    data: migratedData,
    preservedFields,
    legacyScopeSource,
  };
}

export function panelScopeToPersistedConfig(
  config: NormalizedPanelConfig,
  legacyScopeSource: "panelScope" | "viewScope" | null = "panelScope"
): Record<string, unknown> {
  const scopePayload = scopeConfigFromNormalized(config.scope);
  const { viewScope: preservedViewScope, ...otherPreserved } = config.preservedFields;
  const base = {
    configSchemaVersion: config.schemaVersion,
    ...config.data,
    ...otherPreserved,
  };

  if (legacyScopeSource === "viewScope") {
    return {
      ...base,
      viewScope: preservedViewScope ?? scopePayload,
    };
  }

  return {
    ...base,
    panelScope: scopePayload,
  };
}
