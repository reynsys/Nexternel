import { getPool } from "../db.js";
import type { HealthReport } from "./board-health.js";

/**
 * Every health report a board sends, kept for a while: how its Wi‑Fi signal, drops and memory moved
 * over time. The reports that did not arrive say as much as the ones that did: a board that is online
 * but whose messages do not get through leaves a gap.
 */
const KEEP_DAYS = 14;
/** The boards report every minute; a longer silence than this is a gap in the line. */
const GAP_MS = 3 * 60_000;

export async function ensureBoardHealthSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS board_health_samples (
      device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      at         TIMESTAMPTZ NOT NULL,
      rssi       SMALLINT,
      wifi_drops INTEGER,
      mqtt_drops INTEGER,
      heap       INTEGER,
      uptime_s   BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_board_health_samples_device ON board_health_samples (device_id, at DESC);
  `);
}

export async function recordHealthSample(prefix: string, r: HealthReport): Promise<void> {
  await getPool().query(
    `INSERT INTO board_health_samples (device_id, at, rssi, wifi_drops, mqtt_drops, heap, uptime_s)
     SELECT id, $2, $3, $4, $5, $6, $7 FROM devices WHERE mqtt_topic_prefix = $1`,
    [prefix, r.at, r.rssi === null ? null : Math.round(r.rssi), r.wifiDrops, r.mqttDrops, r.heap, r.uptimeS]
  );
}

export type HealthSample = { at: string; rssi: number | null; mqttDrops: number | null };

export type HealthHistory = {
  /** Oldest first; an entry with rssi null marks a gap (no reports in that time). */
  points: { at: string; rssi: number | null }[];
  /** Reports that arrived, and how many there should have been since the first one in this period. */
  received: number;
  expected: number;
  /** The weakest and strongest signal in this period. */
  weakest: number | null;
  strongest: number | null;
  /** Message service drops the board counted in this period (0 restarts its count). */
  mqttDrops: number;
};

/** What the samples (oldest first) say: the line with its gaps, and how many reports got through. */
export function summarizeHealth(samples: HealthSample[], now = new Date()): HealthHistory {
  const points: HealthHistory["points"] = [];
  let mqttDrops = 0;
  let before: HealthSample | null = null;
  for (const s of samples) {
    if (before && Date.parse(s.at) - Date.parse(before.at) > GAP_MS) points.push({ at: before.at, rssi: null });
    if (before && s.mqttDrops !== null && before.mqttDrops !== null) mqttDrops += Math.max(0, s.mqttDrops - before.mqttDrops);
    points.push({ at: s.at, rssi: s.rssi });
    before = s;
  }
  if (before && now.getTime() - Date.parse(before.at) > GAP_MS) points.push({ at: before.at, rssi: null });
  const signals = samples.map((s) => s.rssi).filter((r): r is number => r !== null);
  const first = samples[0];
  return {
    points,
    received: samples.length,
    expected: first ? Math.max(samples.length, Math.floor((now.getTime() - Date.parse(first.at)) / 60_000) + 1) : 0,
    weakest: signals.length ? Math.min(...signals) : null,
    strongest: signals.length ? Math.max(...signals) : null,
    mqttDrops,
  };
}

export async function boardHealthHistory(deviceId: string, hours = 24): Promise<HealthHistory> {
  const rows = await getPool().query<{ at: Date; rssi: number | null; mqtt_drops: number | null }>(
    `SELECT at, rssi, mqtt_drops FROM board_health_samples
     WHERE device_id = $1 AND at >= NOW() - make_interval(hours => $2) ORDER BY at`,
    [deviceId, hours]
  );
  return summarizeHealth(rows.rows.map((r) => ({ at: r.at.toISOString(), rssi: r.rssi, mqttDrops: r.mqtt_drops })));
}

export async function pruneBoardHealth(): Promise<void> {
  await getPool().query(`DELETE FROM board_health_samples WHERE at < NOW() - make_interval(days => $1)`, [KEEP_DAYS]);
}
