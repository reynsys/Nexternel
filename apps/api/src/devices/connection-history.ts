import { getPool } from "../db.js";
import { boardHealth, signalWord } from "./board-health.js";

/** One time a device was offline: from when to when (null = still offline). */
export type Outage = { from: string; to: string | null; minutes: number };

export type ConnectionSummary = {
  /** The device's state now and since when (null when no change was ever recorded). */
  state: "online" | "offline" | "unknown";
  since: string | null;
  /** Times offline in the last 24 hours, newest first. */
  outages: Outage[];
  longestMinutes: number;
  /** Restarts in the last 24 hours (from the board's "time since restart"). */
  restarts: number;
  /** The board's Wi-Fi signal (dBm) and when it last restarted, when the board sends them. */
  wifiDbm: number | null;
  wifiQuality: string | null;
  restartedAt: string | null;
};

type Event = { state: string; at: Date };

/**
 * The outages in `events` (oldest first) that touch the last `hours`, each with its length.
 * An outage still going on ends "now" for its length.
 */
export function summarizeConnection(events: Event[], current: string, now = new Date(), hours = 24): ConnectionSummary {
  const start = now.getTime() - hours * 3600_000;
  const outages: Outage[] = [];
  let openFrom: Date | null = null;
  const restarts = events.filter((e) => e.state === "restart" && e.at.getTime() >= start).length;
  events = events.filter((e) => e.state === "online" || e.state === "offline");
  for (const e of events) {
    if (e.state === "offline" && !openFrom) openFrom = e.at;
    else if (e.state === "online" && openFrom) {
      if (e.at.getTime() >= start) outages.push(outage(openFrom, e.at));
      openFrom = null;
    }
  }
  if (openFrom) outages.push(outage(openFrom, null, now));
  outages.reverse();
  const last = events[events.length - 1];
  const state = current === "online" || current === "offline" ? current : "unknown";
  return {
    state,
    since: last && last.state === state ? last.at.toISOString() : null,
    outages,
    longestMinutes: outages.reduce((m, o) => Math.max(m, o.minutes), 0),
    restarts,
    wifiDbm: null,
    wifiQuality: null,
    restartedAt: null,
  };
}

function outage(from: Date, to: Date | null, now = new Date()): Outage {
  const end = to ?? now;
  return { from: from.toISOString(), to: to ? to.toISOString() : null, minutes: Math.max(0, Math.round((end.getTime() - from.getTime()) / 60_000)) };
}

/** A device's connection summary from the recorded history (last 24 hours, plus the change before). */
export async function deviceConnection(deviceId: string): Promise<ConnectionSummary | null> {
  const pool = getPool();
  const dev = await pool.query<{ mqtt_availability: string; mqtt_topic_prefix: string | null }>(
    `SELECT mqtt_availability, mqtt_topic_prefix FROM devices WHERE id = $1`,
    [deviceId]
  );
  if (!dev.rowCount) return null;
  const rows = await pool.query<{ state: string; at: Date }>(
    `SELECT state, at FROM (
       SELECT state, at FROM device_connection_events WHERE device_id = $1 AND at >= NOW() - INTERVAL '24 hours'
       UNION ALL
       (SELECT state, at FROM device_connection_events WHERE device_id = $1 AND at < NOW() - INTERVAL '24 hours' ORDER BY at DESC LIMIT 1)
     ) e ORDER BY at`,
    [deviceId]
  );
  const h = boardHealth(dev.rows[0]!.mqtt_topic_prefix);
  return {
    ...summarizeConnection(rows.rows, dev.rows[0]!.mqtt_availability),
    wifiDbm: h.wifiDbm,
    wifiQuality: h.wifiDbm !== null ? signalWord(h.wifiDbm) : null,
    restartedAt: h.restartedAt,
  };
}

/** Keep 30 days of history. */
export async function pruneConnectionHistory(): Promise<void> {
  await getPool().query(`DELETE FROM device_connection_events WHERE at < NOW() - INTERVAL '30 days'`);
}
