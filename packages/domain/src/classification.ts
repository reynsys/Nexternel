import type { CapabilityKind } from "./capability.js";
import type { SystemId } from "./system.js";

/**
 * Default System hints when installer has not assigned one.
 * Installer confirms on onboarding — auto is suggest, not silent wrong assignment.
 * See docs/v3/08-SYSTEM-CATALOGUE.md §5.2 and 25-PANEL-ARCHITECTURE-RULES.md
 */
const DEFAULT_SYSTEM_BY_KIND: Partial<Record<CapabilityKind, SystemId>> = {
  brightness: "lighting",
  colour: "lighting",
  temperature: "climate",
  humidity: "climate",
  pressure: "environment",
  battery: "network",
  voltage: "energy",
  current: "energy",
  power: "energy",
  energy: "energy",
  co2: "environment",
  pm1: "environment",
  pm25: "environment",
  pm10: "environment",
  motion: "security",
  door: "security",
  lock: "security",
  alarm: "security",
  camera: "security",
  binary_sensor: "security",
  number: "environment",
  enum: "appliances",
  text: "environment",
  json: "network",
  weather: "environment",
  gps: "vehicles",
};

const FALLBACK_SYSTEM: SystemId = "environment";

export type ClassificationHints = {
  deviceName?: string | null;
  areaName?: string | null;
  capabilityName?: string | null;
};

function combinedHintText(hints?: ClassificationHints): string {
  return [hints?.deviceName, hints?.areaName, hints?.capabilityName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Contextual System for generic switches — never default all switches to lighting. */
export function classifySwitchSystem(hints?: ClassificationHints): SystemId | null {
  const text = combinedHintText(hints);

  if (/pump|valve|irrigation|pond|solenoid|water|sprinkler/.test(text)) {
    return "water";
  }
  if (/gate|door|lock|alarm|motion|security|cctv|camera/.test(text)) {
    return "security";
  }
  if (/light|lamp|spot|flood|bulb|led|dimmer|chandelier/.test(text)) {
    return "lighting";
  }
  if (/fan|extractor|hood|appliance|washer|dryer|oven|dishwasher|socket|plug/.test(text)) {
    return "appliances";
  }
  if (/heater|radiator|hvac|thermostat|climate|boiler/.test(text)) {
    return "climate";
  }
  if (/charger|ev|vehicle|garage door/.test(text)) {
    return "vehicles";
  }
  if (/inverter|meter|power|energy|solar|battery/.test(text)) {
    return "energy";
  }
  if (/router|gateway|modem|ap\b|wifi|network|ups/.test(text)) {
    return "network";
  }

  return null;
}

/** Context-aware System assignment (08 §5.2). Returns null when domain is unknown. */
export function classifySystemForCapability(
  kind: string,
  hints?: ClassificationHints
): SystemId | null {
  if (kind === "switch") {
    return classifySwitchSystem(hints);
  }

  const text = combinedHintText(hints);

  if (
    (kind === "temperature" || kind === "humidity") &&
    /garden|soil|outdoor|pond|greenhouse/.test(text)
  ) {
    return "environment";
  }

  if (kind === "battery" && /ups|router|gateway|modem/.test(text)) {
    return "network";
  }

  const mapped = defaultSystemForKind(kind);
  if (mapped === "garden") {
    return null;
  }
  return mapped;
}

export function defaultSystemForKind(kind: string): SystemId | null {
  if (kind === "switch") {
    return null;
  }
  const mapped = DEFAULT_SYSTEM_BY_KIND[kind as CapabilityKind];
  return mapped ?? FALLBACK_SYSTEM;
}
