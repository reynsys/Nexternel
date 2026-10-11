import type { WidgetInstance } from "../api";

import { panelIsIntegrationKind } from "@nexternel/domain";
import { normalizePanelKind } from "./panel-kind";

/** Panels that load from integrations, not the capability resolver. */
export function isIntegrationPanelKind(kind: string): boolean {
  return panelIsIntegrationKind(normalizePanelKind(kind));
}

export function readPanelWeatherConfig(
  config: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  const out: Record<string, unknown> = {};
  if (typeof config.weatherLocation === "string") {
    out.weatherLocation = config.weatherLocation;
  }
  if (config.weatherLat !== undefined) out.weatherLat = config.weatherLat;
  if (config.weatherLon !== undefined) out.weatherLon = config.weatherLon;
  return out;
}

export function weatherConfigFromWidget(widget: WidgetInstance): Record<string, unknown> {
  return readPanelWeatherConfig(widget.config);
}

export function readPanelDevicesConfig(
  config: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  if (config.offlineOnly === true) return { offlineOnly: true };
  return { offlineOnly: false };
}

export function devicesConfigFromWidget(widget: WidgetInstance): Record<string, unknown> {
  return readPanelDevicesConfig(widget.config);
}
