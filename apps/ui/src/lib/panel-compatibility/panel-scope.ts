import type { PanelContentMode } from "@nexternel/domain";
import { resolvePanelContentMode } from "@nexternel/domain";
import type { NormalizedPanelScope } from "./types";

const SCOPE_KEYS = new Set([
  "inheritSectionArea",
  "areaIds",
  "systemIds",
  "groupIds",
  "contentMode",
  "capabilityIds",
  "cameraIds",
]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function readLegacyScopeSource(
  config: Record<string, unknown>
): "panelScope" | "viewScope" | null {
  if (config.panelScope && typeof config.panelScope === "object") return "panelScope";
  if (config.viewScope && typeof config.viewScope === "object") return "viewScope";
  return null;
}

function readRawScope(
  config: Record<string, unknown>
): Record<string, unknown> | null {
  const panelScope = config.panelScope;
  if (panelScope && typeof panelScope === "object" && !Array.isArray(panelScope)) {
    return panelScope as Record<string, unknown>;
  }
  const viewScope = config.viewScope;
  if (viewScope && typeof viewScope === "object" && !Array.isArray(viewScope)) {
    return viewScope as Record<string, unknown>;
  }
  return null;
}

function resolveContentMode(
  raw: Record<string, unknown> | null,
  scope: Pick<
    NormalizedPanelScope,
    "areaIds" | "systemIds" | "groupIds" | "capabilityIds" | "cameraIds"
  >
): PanelContentMode {
  const explicit = raw?.contentMode;
  if (explicit === "auto" || explicit === "manual") return explicit;
  return resolvePanelContentMode(scope);
}

/**
 * Central scope normalization. All legacy `viewScope` / `panelScope` forms must
 * pass through here before runtime dispatch.
 */
export function normalizePanelScope(
  config: Record<string, unknown>
): { scope: NormalizedPanelScope; legacyScopeSource: "panelScope" | "viewScope" | null } {
  const legacyScopeSource = readLegacyScopeSource(config);
  const raw = readRawScope(config);
  const areaIds = asStringArray(raw?.areaIds);
  const systemIds = asStringArray(raw?.systemIds);
  const groupIds = asStringArray(raw?.groupIds);
  const capabilityIds = asStringArray(raw?.capabilityIds);
  const cameraIds = asStringArray(raw?.cameraIds);
  const contentMode = resolveContentMode(raw, {
    areaIds,
    systemIds,
    groupIds,
    capabilityIds,
    cameraIds,
  });

  return {
    legacyScopeSource,
    scope: {
      inheritSectionArea: Boolean(raw?.inheritSectionArea),
      areaIds,
      systemIds,
      groupIds,
      contentMode,
      capabilityIds: contentMode === "manual" ? capabilityIds : [],
      cameraIds: contentMode === "manual" ? cameraIds : [],
    },
  };
}

export function scopeConfigFromNormalized(
  scope: NormalizedPanelScope
): Record<string, unknown> {
  return {
    inheritSectionArea: scope.inheritSectionArea,
    areaIds: scope.areaIds,
    systemIds: scope.systemIds,
    groupIds: scope.groupIds,
    contentMode: scope.contentMode,
    capabilityIds: scope.capabilityIds,
    cameraIds: scope.cameraIds,
  };
}

export function isScopeConfigKey(key: string): boolean {
  return SCOPE_KEYS.has(key);
}

/** Build normalized scope from a canonical runtime `config.scope` record. */
export function normalizedScopeFromRecord(
  raw: Record<string, unknown>
): NormalizedPanelScope {
  const areaIds = asStringArray(raw.areaIds);
  const systemIds = asStringArray(raw.systemIds);
  const groupIds = asStringArray(raw.groupIds);
  const capabilityIds = asStringArray(raw.capabilityIds);
  const cameraIds = asStringArray(raw.cameraIds);
  const contentMode = resolveContentMode(raw, {
    areaIds,
    systemIds,
    groupIds,
    capabilityIds,
    cameraIds,
  });
  return {
    inheritSectionArea: Boolean(raw.inheritSectionArea),
    areaIds,
    systemIds,
    groupIds,
    contentMode,
    capabilityIds: contentMode === "manual" ? capabilityIds : [],
    cameraIds: contentMode === "manual" ? cameraIds : [],
  };
}
