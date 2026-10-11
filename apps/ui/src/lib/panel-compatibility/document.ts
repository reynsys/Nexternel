import type { DashboardDocument, DashboardSection } from "../../api";
import { migrateDashboardDocument } from "@nexternel/domain";
import {
  applyUiPersistedPanelNormalization,
  resolveDashboardDisplayName,
} from "../dashboard-document";
import { applyDashboardCompatibilityMigrations } from "../panel-normalize";
import { hydrateDashboardPanels } from "./persistence";
import { sectionPanels, sectionWithPanels } from "./section-panels";
import type {
  NormalizedPanelInstance,
  RuntimeDashboardDocument,
} from "./types";

export { applyDashboardCompatibilityMigrations } from "../panel-normalize";

/**
 * Persisted dashboard ingress — domain schema migration + UI persisted panel shape +
 * compatibility migrations. No runtime panel decode.
 */
export function migratePersistedDashboardDocument(
  raw: unknown,
  fallbackName = "Dashboard"
): DashboardDocument {
  const domainDoc = migrateDashboardDocument(raw);
  const name = resolveDashboardDisplayName(domainDoc.name, fallbackName);
  const shaped = applyUiPersistedPanelNormalization({
    ...domainDoc,
    name,
  });
  const sections = applyDashboardCompatibilityMigrations(shaped.sections);
  return {
    ...shaped,
    schemaVersion: 3,
    sections,
  };
}

/**
 * Canonical dashboard ingress for UI runtime.
 *
 * 1. Domain schema/version migration (`migrateDashboardDocument`)
 * 2. UI persisted panel normalization (placement, contribution/echarts types)
 * 3. Compatibility migrations (profile panels, legacy widget plans)
 * 4. Panel decode → `RuntimePanelInstance`
 */
export function normalizeDashboardDocument(
  raw: unknown,
  fallbackName = "Dashboard"
): RuntimeDashboardDocument {
  const persisted = migratePersistedDashboardDocument(raw, fallbackName);
  return hydrateDashboardPanels(persisted);
}

/** Serialize runtime sections using the supported persistence format. */
export function serializeDashboardSections(
  sections: DashboardSection[],
  normalizeInstance: (panel: DashboardSection["panels"][number]) => NormalizedPanelInstance,
  serialize: (
    panel: NormalizedPanelInstance,
    placement: DashboardSection["panels"][number]["layout"]
  ) => DashboardSection["panels"][number]
): DashboardSection[] {
  return sections.map((section) =>
    sectionWithPanels(
      section,
      sectionPanels(section).map((panel) =>
        serialize(normalizeInstance(panel), panel.layout)
      )
    )
  );
}
