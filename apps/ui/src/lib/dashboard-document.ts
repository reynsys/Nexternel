import { migrateContributionPanelType, migrateDashboardDocument } from "@nexternel/domain";
import type {
  DashboardDocument,
  DashboardSection,
  LegacyDashboardSectionFields,
  PanelInstance,
  WidgetInstance,
} from "../api";
import { migrateWidgetToEcharts, isEchartsWidgetType } from "../widgets/echarts/config";
import { enforcePanelPlacement } from "../panels/placement";
import { applyDashboardCompatibilityMigrations } from "./panel-normalize";

export const SECTION_COL_SPANS = [3, 4, 6, 12] as const;
export type SectionColSpan = (typeof SECTION_COL_SPANS)[number];

export const DEFAULT_DASHBOARD_TAB_ICON = "dashboard";
export const DEFAULT_SECTION_ICON = "view-module";

export function normalizeSectionColSpan(value: unknown): SectionColSpan {
  if (value === 3 || value === 4 || value === 6 || value === 12) return value;
  return 12;
}

export function newId(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* LAN HTTP */
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyDocument(name = "Dashboard"): DashboardDocument {
  return {
    schemaVersion: 3,
    name,
    tabIcon: DEFAULT_DASHBOARD_TAB_ICON,
    showTabLabel: true,
    showSectionNav: false,
    gridCols: 10,
    sections: [
      {
        id: "section-main",
        title: "Main",
        order: 0,
        collapsed: false,
        icon: DEFAULT_SECTION_ICON,
        colSpan: 12,
        panels: [],
      },
    ],
  };
}

function normalizeWidget(w: WidgetInstance, index: number): WidgetInstance {
  const id = typeof w.id === "string" && w.id.trim() ? w.id.trim() : newId("widget");
  const raw: Partial<WidgetInstance["layout"]> =
    w.layout && typeof w.layout === "object" && !Array.isArray(w.layout)
      ? w.layout
      : {};
  const layout = {
    i: id,
    x: typeof raw.x === "number" && Number.isFinite(raw.x) ? raw.x : 0,
    y: typeof raw.y === "number" && Number.isFinite(raw.y) ? raw.y : index * 4,
    w: typeof raw.w === "number" && Number.isFinite(raw.w) ? raw.w : 4,
    h: typeof raw.h === "number" && Number.isFinite(raw.h) ? raw.h : 4,
    minW: typeof raw.minW === "number" ? raw.minW : undefined,
    minH: typeof raw.minH === "number" ? raw.minH : undefined,
  };
  const rawType = typeof w.type === "string" && w.type.trim() ? w.type.trim() : "stat";
  const type = migrateContributionPanelType(rawType);
  const bindings =
    w.bindings && typeof w.bindings === "object" && !Array.isArray(w.bindings)
      ? w.bindings
      : {};
  const config =
    w.config && typeof w.config === "object" && !Array.isArray(w.config) ? w.config : {};
  const base: WidgetInstance = {
    ...w,
    id,
    type,
    layout,
    bindings,
    config,
  };
  const migrated = isEchartsWidgetType(base.type) ? migrateWidgetToEcharts(base) : base;
  return enforcePanelPlacement(migrated);
}

function migratePanels(panels: PanelInstance[]): PanelInstance[] {
  return panels.map((w, i) => normalizeWidget(w, i));
}

/** Prefer the DB/dashboard row name when loading a tab. */
export function resolveDashboardDisplayName(
  documentName: string,
  fallbackName: string
): string {
  const fromFallback = typeof fallbackName === "string" ? fallbackName.trim() : "";
  const fromDoc = typeof documentName === "string" ? documentName.trim() : "";
  return fromFallback || fromDoc || "Dashboard";
}

/** UI-only persisted panel records after domain schema migration (placement, echarts, types). */
export function applyUiPersistedPanelNormalization(
  doc: DashboardDocument
): DashboardDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => {
      const panels = migratePanels(sectionPanelsForMigration(section));
      const { widgets: _legacy, ...rest } = section as DashboardSection &
        LegacyDashboardSectionFields;
      return {
        ...rest,
        panels,
      };
    }),
  };
}

function sectionPanelsForMigration(
  section: DashboardSection & LegacyDashboardSectionFields
): PanelInstance[] {
  if (Array.isArray(section.panels) && section.panels.length > 0) {
    return section.panels;
  }
  if (Array.isArray(section.widgets) && section.widgets.length > 0) {
    return section.widgets;
  }
  return [];
}

/**
 * Structural normalization to schema v3 persisted shape.
 * @deprecated Prefer `migratePersistedDashboardDocument()` for full ingress.
 */
export function normalizeDocument(raw: unknown, fallbackName = "Dashboard"): DashboardDocument {
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

export function nextWidgetY(widgets: WidgetInstance[]): number {
  if (widgets.length === 0) return 0;
  return Math.max(...widgets.map((w) => w.layout.y + w.layout.h));
}

/** Place next widget to the right when space remains, else next row. */
export function nextWidgetPlacement(
  widgets: WidgetInstance[],
  w: number,
  cols = 12
): { x: number; y: number } {
  if (widgets.length === 0) return { x: 0, y: 0 };
  const byRow = new Map<number, WidgetInstance[]>();
  for (const widget of widgets) {
    const row = widget.layout.y;
    const list = byRow.get(row) ?? [];
    list.push(widget);
    byRow.set(row, list);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  for (const row of rows) {
    const rowWidgets = byRow.get(row)!;
    const maxRight = Math.max(...rowWidgets.map((x) => x.layout.x + x.layout.w));
    if (maxRight + w <= cols) {
      return { x: maxRight, y: row };
    }
  }
  return { x: 0, y: nextWidgetY(widgets) };
}

export function sortSections<S extends { order: number }>(sections: S[]): S[] {
  return [...sections].sort((a, b) => a.order - b.order);
}

export function sectionColSpanLabel(span: SectionColSpan): string {
  switch (span) {
    case 12:
      return "Full";
    case 6:
      return "Half";
    case 4:
      return "Third";
    case 3:
      return "Quarter";
    default:
      return "Full";
  }
}
