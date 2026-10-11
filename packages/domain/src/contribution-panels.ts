/**
 * Dashboard contribution panel types — V5 Panel registry path.
 * Distinct from core scoped/integration `panel.*` panels (PanelWidget path).
 */

/** Core bundled gauge dial — not a Plugin. */
export const PANEL_GAUGE_TYPE = "panel.gauge";

/** Persisted legacy types → current types (dashboard migration read). */
export const LEGACY_CONTRIBUTION_PANEL_TYPES: Readonly<Record<string, string>> = {
  "plugin.gauge": PANEL_GAUGE_TYPE,
  "plugin.clock": "panel.clock",
};

export function migrateContributionPanelType(type: string): string {
  return LEGACY_CONTRIBUTION_PANEL_TYPES[type] ?? type;
}

/** True when the dashboard tile is provided by an optional Plugin (not core). */
export function isPluginPanelType(type: string): boolean {
  const migrated = migrateContributionPanelType(type);
  return migrated.startsWith("plugin.");
}

/** Contribution panels rendered via PanelHost contribution registry (gauge, echarts, plugins). */
export function isContributionPanelType(type: string): boolean {
  const migrated = migrateContributionPanelType(type);
  return migrated === PANEL_GAUGE_TYPE || isPluginPanelType(migrated);
}
