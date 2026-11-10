import {
  isContributionPanelType,
  isCorePanelKind,
  isPluginPanelType,
  migrateContributionPanelType,
} from "@nexternel/domain";
import type { ExportedDashboard } from "../migrate/types.js";

export function isPanelType(type: string): boolean {
  const migrated = migrateContributionPanelType(type);
  if (isCorePanelKind(migrated)) return true;
  if (migrated.startsWith("panel.")) return true;
  if (migrated.startsWith("view.")) return true;
  if (isContributionPanelType(migrated) && !isPluginPanelType(migrated)) return true;
  return false;
}

export function isPluginType(type: string): boolean {
  return isPluginPanelType(migrateContributionPanelType(type));
}

export function countPanelsAndPlugins(dashboards: ExportedDashboard[]): {
  panels: number;
  plugins: number;
} {
  let panels = 0;
  let plugins = 0;
  for (const dash of dashboards) {
    const doc = dash.document as {
      sections?: { panels?: { type?: string }[]; widgets?: { type?: string }[] }[];
    };
    for (const section of doc?.sections ?? []) {
      // V5 saves `panels`; older documents used `widgets`.
      const items = section.panels?.length ? section.panels : (section.widgets ?? []);
      for (const w of items) {
        const t = w.type ?? "";
        if (isPanelType(t)) panels += 1;
        else if (isPluginType(t)) plugins += 1;
      }
    }
  }
  return { panels, plugins };
}

/** What a restore is checked against: the backup's own counts (older backups may lack some). */
export type RestoreExpectation = { areas: number; devices: number; users: number };

/**
 * Why a finished restore does not match its backup, in plain words; null when it does.
 * A home may rightly have no areas or devices yet (a new home): only what the backup held is expected.
 */
export function restoreCountsProblem(expected: RestoreExpectation | null, found: RestoreExpectation): string | null {
  if (found.users === 0) return "No accounts were found after the restore, so nobody could sign in.";
  if (!expected) return null;
  const missing = [
    found.areas < expected.areas ? `${expected.areas - found.areas} of ${expected.areas} areas` : null,
    found.devices < expected.devices ? `${expected.devices - found.devices} of ${expected.devices} devices` : null,
    found.users < expected.users ? `${expected.users - found.users} of ${expected.users} accounts` : null,
  ].filter(Boolean);
  return missing.length ? `Not everything came back from the backup: ${missing.join(", ")} are missing.` : null;
}
