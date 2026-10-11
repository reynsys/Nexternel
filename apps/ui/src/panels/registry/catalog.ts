import type { ContributionPanelCatalogItem } from "@nexternel/domain";
import { listPanelRegistrations } from "./store";

export function listContributionCatalogEntries(): ContributionPanelCatalogItem[] {
  return listPanelRegistrations()
    .filter(
      (entry) =>
        entry.descriptor.source === "contribution" || entry.descriptor.source === "plugin"
    )
    .map((entry) => ({
      source: "contribution" as const,
      type: entry.descriptor.type,
      label: entry.descriptor.label,
      description: entry.descriptor.description ?? entry.descriptor.label,
      category: entry.descriptor.category ?? "plugins",
      needsCapability: entry.descriptor.needsCapability ?? true,
      sortOrder: entry.descriptor.sortOrder ?? 2000,
    }));
}

export function getPanelDescriptor(type: string) {
  const entry = listPanelRegistrations().find(
    (item) => item.descriptor.type === type
  );
  return entry?.descriptor ?? null;
}
