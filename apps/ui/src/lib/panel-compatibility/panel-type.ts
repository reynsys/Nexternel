import {
  isContributionPanelType,
  migrateContributionPanelType,
  normalizePanelKind,
} from "@nexternel/domain";
import { isEchartsWidgetType, migrateWidgetToEcharts } from "../../widgets/echarts/config";
import type { WidgetInstance } from "../../api";
import type { PanelAvailability } from "./types";

const KNOWN_LEGACY_WIDGET_TYPES = new Set([
  "stat",
  "switch",
  "relay",
  "camera",
  "weather",
  "calendar",
  "device_status",
  "system_info",
  "gauge",
  "history",
  "echarts",
]);

/** Core scoped/integration panels (PanelWidget path), not contributions. */
export function isCorePanelType(type: string): boolean {
  const normalized = normalizePanelKind(type);
  const migrated = migrateContributionPanelType(normalized);
  if (isContributionPanelType(migrated)) return false;
  return migrated.startsWith("panel.") || type.startsWith("view.");
}

export type MigratedPanelType = {
  type: string;
  sourceType: string;
  typeMigrated: boolean;
  availability: PanelAvailability;
};

/**
 * Deterministic Panel type normalization.
 * Unknown future types are preserved verbatim.
 */
export function migratePanelType(type: string): MigratedPanelType {
  const sourceType = type.trim() || "stat";
  const contributionMigrated = migrateContributionPanelType(sourceType);
  const kindNormalized = normalizePanelKind(contributionMigrated);
  const typeMigrated =
    contributionMigrated !== sourceType || kindNormalized !== contributionMigrated;

  if (kindNormalized.startsWith("panel.") || kindNormalized.startsWith("plugin.")) {
    return {
      type: kindNormalized,
      sourceType,
      typeMigrated,
      availability: "known",
    };
  }

  if (isEchartsWidgetType(kindNormalized) || isEchartsWidgetType(sourceType)) {
    return {
      type: "echarts",
      sourceType,
      typeMigrated: sourceType !== "echarts",
      availability: "known",
    };
  }

  if (KNOWN_LEGACY_WIDGET_TYPES.has(sourceType)) {
    return {
      type: sourceType,
      sourceType,
      typeMigrated: false,
      availability: "unsupported_legacy",
    };
  }

  return {
    type: sourceType,
    sourceType,
    typeMigrated: false,
    availability: "unknown",
  };
}

/** Apply ECharts configuration migration without changing Dashboard placement. */
export function migrateEchartsWidget(widget: WidgetInstance): WidgetInstance {
  if (!isEchartsWidgetType(widget.type) && !isEchartsWidgetType(migratePanelType(widget.type).type)) {
    return widget;
  }
  const migrated = migrateWidgetToEcharts({ ...widget, type: "echarts" });
  return migrated;
}
