import type { WidgetInstance } from "../../api";

export const GENERAL_WIDGET_TYPES = [
  "calendar",
  "clock",
  "weather",
  "system_info",
  "device_status",
  "camera",
] as const;

export type GeneralWidgetType = (typeof GENERAL_WIDGET_TYPES)[number];

export function isGeneralWidgetType(type: string): type is GeneralWidgetType {
  return (GENERAL_WIDGET_TYPES as readonly string[]).includes(type);
}

export type WeatherConfig = {
  weatherLocation?: string;
  weatherLat?: number;
  weatherLon?: number;
};

export type DeviceStatusConfig = {
  offlineOnly?: boolean;
};

export type CameraConfig = {
  cameraId?: string;
  /** Set by Cameras panel — suppress in-widget titles; panel chrome owns the label. */
  embeddedInPanel?: boolean;
};

/** Coerce number | numeric string — string coords used to fall back to London silently. */
export function coerceCoord(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim()) n = Number(value.trim());
  else return fallback;
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
}

export function parseWeatherConfig(config: Record<string, unknown> | undefined): {
  weatherLocation: string;
  weatherLat: number;
  weatherLon: number;
} {
  const weatherLocation =
    typeof config?.weatherLocation === "string" && config.weatherLocation.trim()
      ? config.weatherLocation.trim()
      : "Weather";
  const weatherLat = coerceCoord(config?.weatherLat, 51.5074, -90, 90);
  const weatherLon = coerceCoord(config?.weatherLon, -0.1278, -180, 180);
  return { weatherLocation, weatherLat, weatherLon };
}

export function parseDeviceStatusConfig(
  config: Record<string, unknown> | undefined
): { offlineOnly: boolean } {
  return { offlineOnly: config?.offlineOnly === true };
}

export function parseCameraConfig(
  config: Record<string, unknown> | undefined
): { cameraId: string; embeddedInPanel: boolean } {
  const cameraId =
    typeof config?.cameraId === "string" && config.cameraId.trim()
      ? config.cameraId.trim()
      : "";
  return {
    cameraId,
    embeddedInPanel: config?.embeddedInPanel === true,
  };
}

export function generalDefaultSize(type: GeneralWidgetType): { w: number; h: number } {
  switch (type) {
    case "calendar":
      return { w: 5, h: 7 };
    case "weather":
      return { w: 8, h: 4 };
    case "system_info":
      return { w: 8, h: 4 };
    case "device_status":
      return { w: 4, h: 4 };
    case "camera":
      return { w: 8, h: 4 };
    default:
      return { w: 4, h: 4 };
  }
}

export function generalDefaultConfig(type: GeneralWidgetType): Record<string, unknown> {
  switch (type) {
    case "weather":
      return {
        weatherLocation: "London",
        weatherLat: 51.5074,
        weatherLon: -0.1278,
      };
    case "device_status":
      return { offlineOnly: false };
    case "camera":
      return { cameraId: "" };
    default:
      return {};
  }
}

export function widgetTitleOr(
  widget: WidgetInstance,
  fallback: string
): string | undefined {
  const t = widget.title?.trim();
  if (!t) return undefined;
  if (t === fallback || t === widget.type) return undefined;
  if (
    t === "Calendar" ||
    t === "Weather" ||
    t === "System information" ||
    t === "System" ||
    t === "Device status" ||
    t === "Devices" ||
    t === "Camera" ||
    t === "Camera live stream" ||
    t === "Clock"
  ) {
    return undefined;
  }
  return t;
}

/** Editor / standalone preview — returns fallback when no custom title. */
export function generalWidgetHeading(
  widget: WidgetInstance,
  fallback: string
): string {
  return widgetTitleOr(widget, fallback) ?? fallback;
}

