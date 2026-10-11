import type { PanelInstance } from "../api";
import { normalizePanelKind } from "./panel-kind";
import { isPanelWidgetType } from "../widgets/panel";
import {
  getPanelScopeMode,
  migrateContributionPanelType,
  panelIsIntegrationKind,
  type PanelScopeMode,
} from "@nexternel/domain";
import type { GeneralWidgetType } from "../widgets/general/config";
import { GAUGE_WIDGET_TYPE } from "../widgets/gauge";
import { isEchartsWidgetType } from "../widgets/echarts/config";

export type DashboardEditorKind = "scoped-panel" | "integration-panel" | "gauge" | null;

const INTEGRATION_GENERAL_TYPE: Partial<Record<string, GeneralWidgetType>> = {
  "panel.weather": "weather",
  "panel.system": "system_info",
  "panel.calendar": "calendar",
  "panel.clock": "clock",
  "panel.devices": "device_status",
};

/** Map `panel.*` integration kinds to legacy general editor types for the shared editor. */
export function panelAsGeneralWidget(panel: PanelInstance): PanelInstance | null {
  if (!isPanelWidgetType(panel.type)) return null;
  const kind = normalizePanelKind(panel.type);
  if (!panelIsIntegrationKind(kind)) return null;
  const generalType = INTEGRATION_GENERAL_TYPE[kind];
  if (!generalType) return null;
  return { ...panel, type: generalType };
}

export function resolveDashboardEditorKind(panel: PanelInstance): DashboardEditorKind {
  const type = migrateContributionPanelType(panel.type);
  if (type === GAUGE_WIDGET_TYPE || isEchartsWidgetType(type)) return "gauge";
  if (!isPanelWidgetType(type)) return null;
  const mode = getPanelScopeMode(type);
  if (mode === "integration") return "integration-panel";
  return "scoped-panel";
}

export function panelScopeModeForAdd(kind: string): PanelScopeMode {
  return getPanelScopeMode(kind);
}
