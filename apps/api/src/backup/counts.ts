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
