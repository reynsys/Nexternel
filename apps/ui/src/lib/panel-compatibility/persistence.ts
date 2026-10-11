import type {
  DashboardDocument,
  DashboardSection,
  LegacyDashboardSectionFields,
} from "../../api";
import { enforcePanelPlacement, layoutForPersistence } from "../../panels/placement";
import { decodePanelInstance, ensureRuntimePanel } from "./normalize-panel";
import { serializePanelInstance } from "./serialize-panel";
import { normalizeSectionPanelsOnLoad, sectionPanels } from "./section-panels";
import type { RuntimeDashboardSection } from "./types";

/**
 * Serialize dashboard sections to V5 schema v3 (`sections.panels[]`).
 * Preserves panel identity and configuration through the compatibility layer.
 */
export function serializeDashboardDocumentV3(
  doc: Omit<DashboardDocument, "schemaVersion"> & { schemaVersion?: number }
): DashboardDocument {
  const sections = doc.sections.map((section) => serializeSectionPanelsV3(section));
  return {
    ...doc,
    schemaVersion: 3,
    sections,
  };
}

export function serializeSectionPanelsV3(
  section: DashboardSection | RuntimeDashboardSection
): DashboardSection {
  const panels = sectionPanels(section).map((panel) => {
    const runtime = ensureRuntimePanel(panel);
    const placed = enforcePanelPlacement(runtime);
    return serializePanelInstance(runtime, layoutForPersistence(placed));
  });
  const { widgets: _legacyWidgets, ...rest } = section as DashboardSection & {
    widgets?: unknown;
  };
  return {
    ...rest,
    panels,
  };
}

/** Read path: decode persisted panels into canonical runtime instances. */
export function hydrateSectionPanels(section: DashboardSection): RuntimeDashboardSection {
  const normalized = normalizeSectionPanelsOnLoad(section);
  return {
    ...normalized,
    panels: sectionPanels(normalized).map((panel) => decodePanelInstance(panel)),
  };
}

export function hydrateDashboardPanels(
  doc: Omit<DashboardDocument, "sections"> & {
    /** Saved sections; v2 documents may still carry legacy `widgets[]`. */
    sections: (DashboardSection & LegacyDashboardSectionFields)[];
  }
): DashboardDocument & { sections: RuntimeDashboardSection[] } {
  return {
    ...doc,
    sections: doc.sections.map(hydrateSectionPanels),
  };
}
