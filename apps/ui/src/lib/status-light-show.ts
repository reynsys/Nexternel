import type { StatusLightSettings, StatusState } from "@nexternel/domain";

/** Kinds of reading that are not plain numbers, so limits (and lights) make no sense for them. */
const NON_NUMERIC_KINDS = new Set([
  "switch",
  "binary_sensor",
  "motion",
  "door",
  "lock",
  "camera",
  "alarm",
  "weather",
  "gps",
  "enum",
  "text",
  "json",
  "colour",
]);

export function readingCanHaveLight(kind: string | null | undefined): boolean {
  return Boolean(kind) && !NON_NUMERIC_KINDS.has(kind as string);
}

/**
 * What a panel shows for one reading: its colour, an empty "not set up" outline when the reading
 * could have a light but has no limits yet, or nothing (not a number, or its light switched off).
 */
export function lightToShow(
  status: { state: StatusState | null; settings: StatusLightSettings | null } | null | undefined,
  kind: string | null | undefined,
  value: unknown
): StatusState | "unset" | null {
  if (!readingCanHaveLight(kind)) return null;
  if (status?.settings && !status.settings.enabled) return null;
  if (status?.state) return status.state;
  if (status?.settings) return "stale"; // has limits but no value since the server started: grey
  // No limits yet. A text value (e.g. a mode name) never gets a light.
  if (value !== undefined && value !== null && typeof value !== "number" && !Number.isFinite(Number(value))) return null;
  return "unset";
}
