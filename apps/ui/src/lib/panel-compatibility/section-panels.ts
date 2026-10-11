import type { DashboardSection, LegacyDashboardSectionFields } from "../../api";

/** Any section shape: saved (`DashboardSection`) or runtime (`RuntimeDashboardSection`). */
type SectionWith<P> = Omit<DashboardSection, "panels"> & { panels: P[]; widgets?: P[] };

/**
 * Runtime read path — canonical Panel list for a section (LAW 011 boundary).
 * Prefers persisted `panels[]`; falls back to legacy `widgets[]` for v2 documents.
 * Returns the same panel shape the section holds (saved in, saved out; runtime in, runtime out).
 */
export function sectionPanels<P>(section: SectionWith<P>): P[] {
  if (Array.isArray(section.panels) && section.panels.length > 0) {
    return section.panels;
  }
  return Array.isArray(section.widgets) ? section.widgets : [];
}

/**
 * Runtime write path — updates canonical `panels[]` only (V5 target model).
 * Legacy `widgets[]` is not populated in runtime state.
 */
export function sectionWithPanels<S extends SectionWith<unknown>, P>(
  section: S,
  panels: P[]
): Omit<S, "panels" | "widgets"> & { panels: P[] } {
  const { widgets: _legacy, panels: _old, ...rest } = section;
  return {
    ...rest,
    panels,
  };
}

/**
 * Load-boundary normalization — reads legacy `widgets[]` when `panels[]` absent,
 * returns canonical panels-only section for V5 runtime.
 */
export function normalizeSectionPanelsOnLoad(
  section: DashboardSection & LegacyDashboardSectionFields
): DashboardSection {
  return sectionWithPanels(section, sectionPanels(section));
}

export function sectionPanelCount(section: DashboardSection): number {
  return sectionPanels(section).length;
}
