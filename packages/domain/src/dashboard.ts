import { z } from "zod";

/** Grid placement for one panel instance (React Grid Layout compatible). */
export const PanelLayoutSchema = z.object({
  i: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  minW: z.number().int().positive().optional(),
  minH: z.number().int().positive().optional(),
});

export type PanelLayout = z.infer<typeof PanelLayoutSchema>;

/** @deprecated Legacy layout schema name — use `PanelLayoutSchema`. */
export const WidgetLayoutSchema = PanelLayoutSchema;
/** @deprecated Legacy layout type — use `PanelLayout`. */
export type WidgetLayout = PanelLayout;

/** Canonical V5 panel instance — JSON-defined; bound to capabilities. */
export const PanelInstanceSchema = z.object({
  id: z.string(),
  type: z.string().min(1),
  title: z.string().optional(),
  layout: PanelLayoutSchema,
  bindings: z.record(z.unknown()).default({}),
  config: z.record(z.unknown()).default({}),
});

export type PanelInstance = z.infer<typeof PanelInstanceSchema>;

/** Legacy read-only widget instance (v1/v2 documents). Same shape as `PanelInstance`. */
export const WidgetInstanceSchema = PanelInstanceSchema;
/** @deprecated Legacy type name — use `PanelInstance`. Retained for v1/v2 read compatibility. */
export type WidgetInstance = PanelInstance;

/** Allowed section widths on a 12-column CSS grid. */
export const SECTION_COL_SPANS = [3, 4, 6, 12] as const;
export type SectionColSpan = (typeof SECTION_COL_SPANS)[number];

export function normalizeSectionColSpan(value: unknown): SectionColSpan {
  if (value === 3 || value === 4 || value === 6 || value === 12) return value;
  return 12;
}

export const DEFAULT_DASHBOARD_TAB_ICON = "dashboard";
export const DEFAULT_SECTION_ICON = "view-module";

/**
 * Canonical V3/V5 dashboard section — Panel-based persistence model.
 * Does not define legacy `widgets[]`.
 */
export const DashboardSectionV3Schema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  collapsed: z.boolean().optional().default(false),
  roomId: z.string().nullable().optional(),
  /** Catalog icon id (see UI dashboard-icons). */
  icon: z.string().optional(),
  /** Width on 12-col section grid: 12 full, 6 half, 4 third, 3 quarter. */
  colSpan: z.number().int().optional(),
  panels: z.array(PanelInstanceSchema).default([]),
});

export type DashboardSectionV3 = z.infer<typeof DashboardSectionV3Schema>;

/**
 * Legacy v2 dashboard section — reads `sections.widgets[]` from older documents.
 */
export const LegacyDashboardSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  collapsed: z.boolean().optional().default(false),
  roomId: z.string().nullable().optional(),
  icon: z.string().optional(),
  colSpan: z.number().int().optional(),
  widgets: z.array(WidgetInstanceSchema).default([]),
  /** Optional when a partially migrated document already has panels. */
  panels: z.array(PanelInstanceSchema).optional(),
});

export type LegacyDashboardSection = z.infer<typeof LegacyDashboardSectionSchema>;

/** Canonical dashboard section (schema v3+). */
export type DashboardSection = DashboardSectionV3;

/** @deprecated Use `DashboardSectionV3Schema` — retained for legacy imports. */
export const DashboardSectionSchema = DashboardSectionV3Schema;

/** Persisted dashboard document schema v3 (V5 panels). */
export const DashboardDocumentV3Schema = z.object({
  schemaVersion: z.literal(3),
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  tabIcon: z.string().optional(),
  showTabLabel: z.boolean().optional().default(true),
  showSectionNav: z.boolean().optional().default(false),
  sections: z.array(DashboardSectionV3Schema).default([]),
});

export type DashboardDocumentV3 = z.infer<typeof DashboardDocumentV3Schema>;

/** Canonical persisted dashboard document (V5 — schema v3). */
export type PersistedDashboardDocument = DashboardDocumentV3;

/** Legacy persisted dashboard document (PostgreSQL JSONB) — v2 compatibility read. */
export const DashboardDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  /** Top tab bar icon catalog id. */
  tabIcon: z.string().optional(),
  /** When false, tab shows icon only (tooltip for name). */
  showTabLabel: z.boolean().optional().default(true),
  /** Section quick-jump chips below the tab bar (off by default). */
  showSectionNav: z.boolean().optional().default(false),
  sections: z.array(LegacyDashboardSectionSchema).default([]),
});

export type DashboardDocument = z.infer<typeof DashboardDocumentSchema>;

/** Legacy flat document (schemaVersion 1). */
export const DashboardDocumentV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  widgets: z.array(WidgetInstanceSchema).default([]),
});

export const CURRENT_DASHBOARD_SCHEMA_VERSION = 3 as const;
export const LEGACY_DASHBOARD_SCHEMA_VERSION = 2 as const;

function coercePanelInstance(raw: unknown, index: number): PanelInstance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : `panel-${index + 1}`;
  const type =
    typeof record.type === "string" && record.type.trim() ? record.type.trim() : "stat";
  const layoutRaw =
    record.layout && typeof record.layout === "object" && !Array.isArray(record.layout)
      ? (record.layout as Record<string, unknown>)
      : {};
  const layout: PanelLayout = {
    i: typeof layoutRaw.i === "string" ? layoutRaw.i : id,
    x: typeof layoutRaw.x === "number" && Number.isFinite(layoutRaw.x) ? layoutRaw.x : 0,
    y:
      typeof layoutRaw.y === "number" && Number.isFinite(layoutRaw.y)
        ? layoutRaw.y
        : index * 4,
    w: typeof layoutRaw.w === "number" && Number.isFinite(layoutRaw.w) ? layoutRaw.w : 4,
    h: typeof layoutRaw.h === "number" && Number.isFinite(layoutRaw.h) ? layoutRaw.h : 4,
    minW: typeof layoutRaw.minW === "number" ? layoutRaw.minW : undefined,
    minH: typeof layoutRaw.minH === "number" ? layoutRaw.minH : undefined,
  };
  const bindings =
    record.bindings && typeof record.bindings === "object" && !Array.isArray(record.bindings)
      ? { ...(record.bindings as Record<string, unknown>) }
      : {};
  const config =
    record.config && typeof record.config === "object" && !Array.isArray(record.config)
      ? { ...(record.config as Record<string, unknown>) }
      : {};
  const title = typeof record.title === "string" ? record.title : undefined;
  return { id, type, title, layout, bindings, config };
}

function readPanelList(rawList: unknown[] | undefined): PanelInstance[] {
  if (!Array.isArray(rawList)) return [];
  const panels: PanelInstance[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const strict = PanelInstanceSchema.safeParse(rawList[i]);
    if (strict.success) {
      panels.push(strict.data);
      continue;
    }
    const coerced = coercePanelInstance(rawList[i], i);
    if (coerced) panels.push(coerced);
  }
  return panels;
}

function sectionPanelsFromRaw(section: Record<string, unknown>): PanelInstance[] {
  const panels = readPanelList(
    Array.isArray(section.panels) ? (section.panels as unknown[]) : undefined
  );
  if (panels.length > 0) return panels;
  return readPanelList(
    Array.isArray(section.widgets) ? (section.widgets as unknown[]) : undefined
  );
}

function normalizeSectionV3FromRaw(raw: unknown, index: number): DashboardSectionV3 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const section = raw as Record<string, unknown>;
  const id =
    typeof section.id === "string" && section.id.trim()
      ? section.id.trim()
      : `section-${index + 1}`;
  const title =
    typeof section.title === "string" && section.title.trim()
      ? section.title.trim()
      : `Section ${index + 1}`;
  const panels = sectionPanelsFromRaw(section);
  return {
    id,
    title,
    order:
      typeof section.order === "number" && Number.isFinite(section.order)
        ? section.order
        : index,
    collapsed: Boolean(section.collapsed),
    roomId:
      section.roomId === null
        ? null
        : typeof section.roomId === "string"
          ? section.roomId
          : undefined,
    icon:
      typeof section.icon === "string" && section.icon.trim()
        ? section.icon.trim()
        : undefined,
    colSpan: normalizeSectionColSpan(section.colSpan),
    panels,
  };
}

function parseMigrationSections(rawSections: unknown[]): DashboardSectionV3[] {
  const parsed: DashboardSectionV3[] = [];
  for (let i = 0; i < rawSections.length; i++) {
    const section = normalizeSectionV3FromRaw(rawSections[i], i);
    if (section) parsed.push(section);
  }
  return parsed;
}

function documentShell(
  name: string,
  tabIcon: string,
  showTabLabel: boolean,
  showSectionNav: boolean,
  sections: DashboardSectionV3[]
): DashboardDocumentV3 {
  const validated = DashboardDocumentV3Schema.safeParse({
    schemaVersion: 3,
    name,
    tabIcon,
    showTabLabel,
    showSectionNav,
    sections,
  });
  if (validated.success) return validated.data;
  return {
    schemaVersion: 3,
    name,
    tabIcon,
    showTabLabel,
    showSectionNav,
    sections,
  };
}

export function emptyDashboardDocument(name = "Dashboard"): DashboardDocumentV3 {
  return {
    schemaVersion: 3,
    name,
    tabIcon: DEFAULT_DASHBOARD_TAB_ICON,
    showTabLabel: true,
    showSectionNav: false,
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

/**
 * Normalize any stored JSONB to schemaVersion 3 (V5 panels).
 * v1/v2 documents are upgraded on read.
 */
export function migrateDashboardDocument(raw: unknown): PersistedDashboardDocument {
  if (!raw || typeof raw !== "object") {
    return emptyDashboardDocument();
  }
  const doc = raw as Record<string, unknown>;
  const name =
    typeof doc.name === "string" && doc.name.trim() ? doc.name.trim() : "Dashboard";
  const tabIcon =
    typeof doc.tabIcon === "string" && doc.tabIcon.trim()
      ? doc.tabIcon.trim()
      : DEFAULT_DASHBOARD_TAB_ICON;
  const showTabLabel = doc.showTabLabel !== false;
  const showSectionNav = doc.showSectionNav === true;

  if (doc.schemaVersion === 3 && Array.isArray(doc.sections)) {
    const sections = parseMigrationSections(doc.sections).sort((a, b) => a.order - b.order);
    return documentShell(name, tabIcon, showTabLabel, showSectionNav, sections);
  }

  if (doc.schemaVersion === 2 && Array.isArray(doc.sections)) {
    const sections = parseMigrationSections(doc.sections).sort((a, b) => a.order - b.order);
    if (sections.length === 0) {
      return emptyDashboardDocument(name);
    }
    return documentShell(name, tabIcon, showTabLabel, showSectionNav, sections);
  }

  const panels = readPanelList(Array.isArray(doc.widgets) ? (doc.widgets as unknown[]) : []);
  return documentShell(name, tabIcon, showTabLabel, showSectionNav, [
    {
      id: "section-main",
      title: "Main",
      order: 0,
      collapsed: false,
      icon: DEFAULT_SECTION_ICON,
      colSpan: 12,
      panels,
    },
  ]);
}
