/**
 * Unified dashboard Add Panel catalog — core registry panels plus UI contributions.
 */

import { isContributionPanelType, migrateContributionPanelType } from "./contribution-panels.js";

export type PanelCatalogSource = "core" | "contribution";

export type CorePanelCatalogItem = {
  source: "core";
  kind: string;
  label: string;
  description: string;
  sortOrder: number;
};

export type ContributionPanelCatalogItem = {
  source: "contribution";
  type: string;
  label: string;
  description: string;
  sortOrder: number;
};

export type UnifiedPanelCatalogItem =
  | CorePanelCatalogItem
  | ContributionPanelCatalogItem;

export function panelCatalogItemId(item: UnifiedPanelCatalogItem): string {
  return item.source === "core" ? item.kind : item.type;
}

/** Dashboard document `type` for V4 scoped/integration panels — not contribution panels. */
export function isCorePanelCatalogType(type: string): boolean {
  const migrated = migrateContributionPanelType(type);
  if (isContributionPanelType(migrated)) return false;
  return migrated.startsWith("panel.") || migrated.startsWith("view.");
}
