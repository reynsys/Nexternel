import type { ResolvedPanelCapability } from "../api";

export type ParsedCapabilityReading = {
  value: string;
  unit: string;
};

/** What a reading shows while its board cannot read the sensor. */
export const SENSOR_NOT_ANSWERING = "Sensor not answering";

/** Split live capability state into a display value and unit for panel tiles. */
export function parseCapabilityReading(
  cap: Pick<ResolvedPanelCapability, "state" | "unit"> | undefined
): ParsedCapabilityReading {
  if (!cap?.state) return { value: "—", unit: "" };
  if (cap.state.quality === "stale" || cap.state.quality === "unknown") {
    return { value: "—", unit: "" };
  }
  // The board is online but cannot read this sensor (it sends "nan").
  if (cap.state.quality === "error") return { value: SENSOR_NOT_ANSWERING, unit: "" };
  const v = cap.state.value;
  if (typeof v === "boolean") return { value: v ? "ON" : "OFF", unit: "" };
  if (typeof v === "number") {
    const value = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return { value, unit: cap.unit?.trim() ?? "" };
  }
  return { value: String(v), unit: "" };
}
