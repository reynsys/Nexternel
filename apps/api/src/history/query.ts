import { querySensorHistory, type HistoryPoint, type HistoryRange } from "./influx.js";
import { resolveHistoryTarget } from "./resolve.js";

export type HistorySeriesResult = {
  capabilityId: string;
  name: string;
  unit: string | null;
  aggregateEvery: string;
  points: HistoryPoint[];
  error?: string;
};

export async function queryCapabilityHistory(
  capabilityId: string,
  range: HistoryRange
): Promise<HistorySeriesResult> {
  const resolved = await resolveHistoryTarget(capabilityId);
  if (!resolved.ok) {
    return {
      capabilityId,
      name: "",
      unit: null,
      aggregateEvery: "",
      points: [],
      error: resolved.message,
    };
  }

  try {
    const { points, aggregateEvery } = await querySensorHistory(
      resolved.target.deviceSlug,
      resolved.target.entityId,
      range
    );
    return {
      capabilityId: resolved.target.capabilityId,
      name: resolved.target.name,
      unit: resolved.target.unit,
      aggregateEvery,
      points,
    };
  } catch (err) {
    return {
      capabilityId,
      name: resolved.target.name,
      unit: resolved.target.unit,
      aggregateEvery: "",
      points: [],
      error: err instanceof Error ? err.message : "InfluxDB query failed",
    };
  }
}
