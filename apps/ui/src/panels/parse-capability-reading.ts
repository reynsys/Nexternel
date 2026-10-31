import type { ResolvedPanelCapability } from "../api";

export type ParsedCapabilityReading = {
  value: string;
  unit: string;
};

/** Split live capability state into a display value and unit for panel tiles. */
export function parseCapabilityReading(
  cap: Pick<ResolvedPanelCapability, "state" | "unit"> | undefined
): ParsedCapabilityReading {
  if (!cap?.state) return { value: "—", unit: "" };
  if (cap.state.quality === "stale" || cap.state.quality === "unknown") {
    return { value: "—", unit: "" };
  }
  const v = cap.state.value;
  if (typeof v === "boolean") return { value: v ? "ON" : "OFF", unit: "" };
  if (typeof v === "number") {
    const value = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return { value, unit: cap.unit?.trim() ?? "" };
  }
  return { value: String(v), unit: "" };
}
