/**
 * Catalog display names (sensors / relays) — human-readable labels for the UI.
 * Technical ids (ESPHome object_id, Shelly switch:N, …) stay in esphome_entity_id.
 */

/** True when `name` looks like a driver technical id, not a human label. */
export function isTechnicalDisplayName(
  name: string,
  technicalId?: string | null
): boolean {
  const n = name.trim();
  const id = (technicalId ?? "").trim();
  if (!n) return true;
  if (id && n.toLowerCase() === id.toLowerCase()) return true;
  if (/^[a-z][a-z0-9_]*$/.test(n) && n.includes("_")) return true;
  return false;
}

/**
 * Prefer a human-readable catalog name.
 * Uses YAML/import name when present; only derives from technical id when unavoidable.
 */
export function preferCatalogDisplayName(
  candidateName: string,
  technicalId?: string | null
): string {
  const name = candidateName.trim();
  const id = (technicalId ?? "").trim();
  if (name && !isTechnicalDisplayName(name, id)) return name;
  if (id) return humanizeTechnicalId(id);
  return name || "Sensor";
}

/** Measurement names written the usual way (after title-casing). */
const KNOWN_TERMS: [RegExp, string][] = [
  [/\bPm ?10(?:\.0)?\b/g, "PM10"],
  [/\bPm ?(\d+(?:\.\d+)?)\b/g, "PM$1"],
  [/\bCo2\b/g, "CO2"],
  [/\bTvoc\b/g, "TVOC"],
  [/\bVoc\b/g, "VOC"],
  [/\bNox\b/g, "NOx"],
  [/\bAqi\b/g, "AQI"],
  [/\bUv\b/g, "UV"],
  [/\bWifi\b/g, "Wi-Fi"],
  [/\bRssi\b/g, "RSSI"],
  [/\bIp\b/g, "IP"],
];

/**
 * A readable name from a technical id: "pm_2_5" → "PM2.5", "pm_1_0" → "PM1.0", "pm_10_0" → "PM10",
 * "living_room_co2" → "Living Room CO2". Digits split by "_" are one number with a decimal point
 * (ESPHome ids cannot hold a dot).
 */
export function humanizeTechnicalId(id: string): string {
  let out = id
    .trim()
    .replace(/(\d)_(?=\d)/g, "$1.")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  for (const [re, to] of KNOWN_TERMS) out = out.replace(re, to);
  return out;
}

/** The readable name Nexternel made from a technical id before humanizeTechnicalId (to repair saved names). */
export function oldHumanizedId(id: string): string {
  return id
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
