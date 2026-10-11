import type { Capability, WidgetInstance } from "../api";
import { defaultWidgetTitle } from "./capability-labels";

import { switchWidgetLabel, isSwitchWidgetType } from "../widgets/switch";
import { relayPanelLabel, isRelayPanelType } from "../widgets/relay-panel";

const CORE_PLACEHOLDERS = new Set(["Switch", "Stat", "Auto", "Widget"]);

/** Catalog / type labels that should not count as a custom title. */
const GENERAL_PLACEHOLDERS: Record<string, string[]> = {
  calendar: ["Calendar", "calendar"],
  weather: ["Weather", "weather"],
  system_info: ["System information", "System", "system_info"],
  device_status: ["Device status", "Devices", "device_status"],
  "plugin.clock": ["Clock", "plugin.clock"],
  "panel.air-quality": ["Air quality", "Air Quality", "panel.air-quality"],
  "panel.gauge": ["Gauge", "panel.gauge"],
  "plugin.air-quality": ["Air quality", "Air Quality", "plugin.air-quality"],
  "plugin.gauge": ["Gauge", "plugin.gauge"],
};

export function kindLabelForWidgetType(type: string): string {
  if (isRelayPanelType(type)) return relayPanelLabel(type);
  if (isSwitchWidgetType(type)) return switchWidgetLabel(type);
  if (type === "stat") return "Stat";
  if (type === "auto") return "Auto";
  return type;
}

export function isPlaceholderWidgetTitle(
  title: string | undefined,
  type: string
): boolean {
  const t = title?.trim() ?? "";
  if (!t) return true;
  if (t === type) return true;
  if (CORE_PLACEHOLDERS.has(t)) return true;
  if (/^(switch|relay)([_\s-]?\d+)?$/i.test(t)) return true;
  const extras = GENERAL_PLACEHOLDERS[type];
  if (extras?.includes(t)) return true;
  if (isSwitchWidgetType(type) && t === switchWidgetLabel(type)) return true;
  if (isRelayPanelType(type) && t === relayPanelLabel(type)) return true;
  return false;
}

/** Title shown on the dashboard chrome for capability-bound widgets. */
export function resolveWidgetTitle(
  widget: WidgetInstance,
  cap: Capability | undefined
): string {
  if (!isPlaceholderWidgetTitle(widget.title, widget.type)) {
    return widget.title!.trim();
  }
  return defaultWidgetTitle(cap, kindLabelForWidgetType(widget.type));
}

/**
 * Value to put in an Edit Title field for capability-bound widgets —
 * always the same string the user sees on the dashboard.
 */
export function editorTitleForBoundWidget(
  widget: WidgetInstance,
  cap: Capability | undefined
): string {
  return resolveWidgetTitle(widget, cap);
}

/** Persist title: empty / placeholder → undefined (auto from capability). */
export function persistBoundWidgetTitle(
  typed: string,
  widgetType: string,
  cap: Capability | undefined
): string | undefined {
  const t = typed.trim();
  if (!t || isPlaceholderWidgetTitle(t, widgetType)) {
    return undefined;
  }
  const auto = defaultWidgetTitle(cap, kindLabelForWidgetType(widgetType));
  if (t === auto) return undefined;
  return t;
}
