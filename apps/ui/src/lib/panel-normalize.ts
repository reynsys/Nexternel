import type { DashboardSection, WidgetInstance } from "../api";
import { sectionPanels, sectionWithPanels } from "./panel-compatibility/section-panels";
import { normalizePanelKind } from "./panel-kind";
import {
  profileConsolidationSystemIds,
  replaceDeprecatedPanelKind,
} from "./panel-profile-hints";
import { applyPanelMigration, planPanelMigration } from "./panel-migration";
import { isCorePanelType } from "./panel-compatibility/panel-type";

function readRawScope(widget: WidgetInstance): Record<string, unknown> | null {
  const raw = widget.config?.panelScope ?? widget.config?.viewScope;
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

function readScope(widget: WidgetInstance) {
  const raw = readRawScope(widget);
  if (!raw) {
    return {
      inheritSectionArea: false,
      areaIds: [] as string[],
      systemIds: [] as string[],
      groupIds: [] as string[],
    };
  }
  const scope = raw as {
    inheritSectionArea?: boolean;
    areaIds?: string[];
    systemIds?: string[];
    groupIds?: string[];
  };
  return {
    inheritSectionArea: scope.inheritSectionArea ?? false,
    areaIds: scope.areaIds ?? [],
    systemIds: scope.systemIds ?? [],
    groupIds: scope.groupIds ?? [],
  };
}

function panelScopeWithSystemIds(
  widget: WidgetInstance,
  scope: ReturnType<typeof readScope>,
  systemIds: string[]
) {
  const raw = readRawScope(widget);
  return {
    ...(raw ?? {}),
    inheritSectionArea: scope.inheritSectionArea,
    areaIds: scope.areaIds,
    systemIds,
    groupIds: scope.groupIds,
  };
}

/**
 * Normalize legacy/deprecated panel widgets on dashboard load.
 * Profile panels consolidate to Controls/Status with systemIds hints.
 */
export function normalizeDashboardPanelWidgets(
  sections: DashboardSection[]
): DashboardSection[] {
  let changed = false;

  const next = sections.map((section) => {
    const widgets = sectionPanels(section).map((widget) => {
      if (!isCorePanelType(widget.type)) return widget;

      const originalKind = normalizePanelKind(widget.type);
      const replacementKind = replaceDeprecatedPanelKind(widget.type);
      const scope = readScope(widget);
      let systemIds = scope.systemIds;

      if (systemIds.length === 0) {
        systemIds = profileConsolidationSystemIds(originalKind);
      }

      const kindChanged = replacementKind !== originalKind;
      const scopeChanged =
        systemIds.length !== scope.systemIds.length ||
        systemIds.some((id, i) => id !== scope.systemIds[i]);

      if (!kindChanged && !scopeChanged) return widget;

      changed = true;
      return {
        ...widget,
        type: replacementKind,
        config: {
          ...widget.config,
          panelScope: panelScopeWithSystemIds(widget, scope, systemIds),
        },
      };
    });

    return widgets === sectionPanels(section)
      ? section
      : sectionWithPanels(section, widgets);
  });

  return changed ? next : sections;
}

/** Profile consolidation + legacy widget migration plans (persisted sections only). */
export function applyDashboardCompatibilityMigrations(
  sections: DashboardSection[]
): DashboardSection[] {
  const consolidated = normalizeDashboardPanelWidgets(sections);
  const plan = planPanelMigration(consolidated);
  if (plan.actions.length === 0) return consolidated;
  return applyPanelMigration(consolidated, plan);
}

/**
 * @deprecated Prefer `normalizeDashboardDocument()` from `panel-compatibility`.
 * Retained for callers that only have section arrays.
 */
export function prepareDashboardSections(
  sections: DashboardSection[]
): DashboardSection[] {
  return applyDashboardCompatibilityMigrations(sections);
}
