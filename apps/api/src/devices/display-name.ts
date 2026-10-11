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
  if (id) {
    return id
      .replace(/_/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return name || "Sensor";
}
