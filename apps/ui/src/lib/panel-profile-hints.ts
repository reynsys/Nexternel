import type { SystemId } from "@nexternel/domain";
import { normalizePanelKind } from "./panel-kind";

/**
 * Profile panels consolidated into canonical panels + systemIds scope hints.
 * Not an architectural System→Panel binding — instance scope only.
 */
export const PROFILE_PANEL_CONSOLIDATION: Record<
  string,
  { target: string; systemIds: readonly SystemId[] }
> = {
  "panel.climate": { target: "panel.status", systemIds: ["climate"] },
  "panel.environment": { target: "panel.status", systemIds: ["environment"] },
  "panel.energy": { target: "panel.status", systemIds: ["energy"] },
  "panel.security": { target: "panel.status", systemIds: ["security"] },
  "panel.water": { target: "panel.controls", systemIds: ["water"] },
};

/** @deprecated Use profileConsolidationSystemIds — kept for type compatibility. */
export const PANEL_PROFILE_SYSTEM_HINTS: Partial<
  Record<string, readonly SystemId[]>
> = Object.fromEntries(
  Object.entries(PROFILE_PANEL_CONSOLIDATION).map(([kind, entry]) => [
    kind,
    entry.systemIds,
  ])
);

export function profileSystemHintsForPanel(panelKind: string): SystemId[] {
  return profileConsolidationSystemIds(panelKind);
}

export function profileConsolidationSystemIds(kind: string): SystemId[] {
  const normalized = normalizePanelKind(kind);
  const entry = PROFILE_PANEL_CONSOLIDATION[normalized];
  return entry ? [...entry.systemIds] : [];
}

/** Retired panel kinds → replacement kind for dashboard normalization. */
export const DEPRECATED_PANEL_REPLACEMENTS: Record<string, string> = {
  "panel.garden": "panel.controls",
  "panel.garage": "panel.controls",
  "panel.network": "panel.status",
  "panel.media": "panel.controls",
  "panel.appliances": "panel.status",
  "panel.health": "panel.status",
  "view.garden": "panel.controls",
};

export function replaceDeprecatedPanelKind(kind: string): string {
  const normalized = normalizePanelKind(kind);
  const profile = PROFILE_PANEL_CONSOLIDATION[normalized];
  if (profile) return profile.target;
  return DEPRECATED_PANEL_REPLACEMENTS[normalized] ?? normalized;
}
