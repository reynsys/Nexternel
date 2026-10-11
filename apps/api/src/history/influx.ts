import { InfluxDB } from "@influxdata/influxdb-client";
import { config } from "../config.js";

export type HistoryPoint = { t: string; v: number };

export type HistoryRange = "1h" | "6h" | "24h" | "7d";

const RANGE_CONFIG: Record<
  HistoryRange,
  { fluxStart: string; aggregateEvery: string }
> = {
  "1h": { fluxStart: "-1h", aggregateEvery: "1m" },
  "6h": { fluxStart: "-6h", aggregateEvery: "1m" },
  "24h": { fluxStart: "-24h", aggregateEvery: "1m" },
  "7d": { fluxStart: "-7d", aggregateEvery: "5m" },
};

/** Allow only safe tag characters in Flux string literals. */
export function sanitizeInfluxTag(value: string): string {
  if (!/^[a-zA-Z0-9_.:\-]+$/.test(value)) {
    throw new Error(`Invalid Influx tag value: ${value}`);
  }
  return value;
}

export function isHistoryRange(value: string): value is HistoryRange {
  return value === "1h" || value === "6h" || value === "24h" || value === "7d";
}

export function rangeMeta(range: HistoryRange) {
  return RANGE_CONFIG[range];
}

function getQueryApi() {
  const { url, token, org } = config.influx();
  return new InfluxDB({ url, token }).getQueryApi(org);
}

/**
 * Sensor history written by the API
 * (measurement sensor_reading, tags device + entity_id, field value).
 */
export async function querySensorHistory(
  deviceSlug: string,
  entityId: string,
  range: HistoryRange
): Promise<{ points: HistoryPoint[]; aggregateEvery: string }> {
  const device = sanitizeInfluxTag(deviceSlug);
  const entity = sanitizeInfluxTag(entityId);
  const { fluxStart, aggregateEvery } = RANGE_CONFIG[range];
  const { bucket } = config.influx();

  const flux = `
    from(bucket: "${bucket}")
      |> range(start: ${fluxStart})
      |> filter(fn: (r) => r._measurement == "sensor_reading")
      |> filter(fn: (r) => r.device == "${device}")
      |> filter(fn: (r) => r.entity_id == "${entity}")
      |> filter(fn: (r) => r._field == "value")
      |> aggregateWindow(every: ${aggregateEvery}, fn: mean, createEmpty: false)
  `;

  const points: HistoryPoint[] = [];
  const queryApi = getQueryApi();

  await new Promise<void>((resolve, reject) => {
    queryApi.queryRows(flux, {
      next(row, tableMeta) {
        const record = tableMeta.toObject(row);
        const raw = record._value;
        const v = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(v)) return;
        points.push({
          t: String(record._time),
          v: Math.round(v * 10) / 10,
        });
      },
      error(err) {
        reject(err);
      },
      complete() {
        resolve();
      },
    });
  });

  return { points, aggregateEvery };
}

/** Write one reading — `sensor_reading` measurement. */
export async function writeSensorReading(input: {
  deviceSlug: string;
  entityId: string;
  entityType?: string;
  value: number;
  timestampMs?: number;
}): Promise<void> {
  const { url, token, org, bucket } = config.influx();
  if (!token.trim()) return;

  const device = sanitizeInfluxTag(input.deviceSlug);
  const entity = sanitizeInfluxTag(input.entityId);
  const entityType = sanitizeInfluxTag(input.entityType ?? "sensor");
  const value = input.value;
  if (!Number.isFinite(value)) return;

  const ts = input.timestampMs ?? Date.now();
  const line = `sensor_reading,device=${device},entity_type=${entityType},entity_id=${entity} value=${value} ${ts}`;

  const res = await fetch(
    `${url.replace(/\/$/, "")}/api/v2/write?org=${encodeURIComponent(org)}&bucket=${encodeURIComponent(bucket)}&precision=ms`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "text/plain; charset=utf-8",
      },
      body: line,
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      body.trim()
        ? `Influx write failed: ${body.trim().slice(0, 200)}`
        : `Influx write HTTP ${res.status}`
    );
  }
}
