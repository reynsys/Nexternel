import { getPool } from "../db.js";

/**
 * A board's own health, from two readings every Nexternel board sends (esphome/packages/
 * nexternel-device.yaml): its Wi-Fi signal and its time since restart. Not dashboard readings —
 * they show in the device's Connection part. A restart is added to the device's connection history.
 */
export type BoardHealth = { wifiDbm: number | null; wifiAt: string | null; restartedAt: string | null };

const health = new Map<string, { wifiDbm?: number; wifiAt?: string; uptimeS?: number; restartedAt?: string }>();

/** The topics, from the readings' names in the shared board file ("WiFi signal" → wifi_signal). */
const HEALTH_TOPIC = /^(.+)\/sensor\/(wifi_signal|uptime)\/state$/;

/** How good a Wi-Fi signal is, in words. */
export function signalWord(dbm: number): "good" | "fair" | "weak" | "very weak" {
  if (dbm >= -60) return "good";
  if (dbm >= -70) return "fair";
  if (dbm >= -80) return "weak";
  return "very weak";
}

/** True when the message was a board-health reading (handled here, not a dashboard reading). */
export function applyBoardHealthTopic(topic: string, payload: string, retained: boolean, prefixOf: (topic: string) => string | null): boolean {
  const m = HEALTH_TOPIC.exec(topic);
  if (!m) return false;
  const prefix = prefixOf(topic);
  if (!prefix || prefix !== m[1]) return false;
  // A kept (retained) value is from some time ago: its "time since restart" would point to the wrong moment.
  if (retained) return true;
  const value = Number(payload.trim());
  if (!Number.isFinite(value)) return true;
  const now = Date.now();
  const h = health.get(prefix) ?? {};
  if (m[2] === "wifi_signal") {
    h.wifiDbm = Math.round(value);
    h.wifiAt = new Date(now).toISOString();
  } else {
    const restartedAt = new Date(now - value * 1000);
    // Time since restart went down: the board restarted. Recorded once, at the moment it restarted.
    if (h.uptimeS !== undefined && value + 60 < h.uptimeS) {
      void getPool()
        .query(`INSERT INTO device_connection_events (device_id, state, at) SELECT id, 'restart', $2 FROM devices WHERE mqtt_topic_prefix = $1`, [prefix, restartedAt])
        .catch(() => undefined);
    }
    h.uptimeS = value;
    h.restartedAt = restartedAt.toISOString();
  }
  health.set(prefix, h);
  return true;
}

export function boardHealth(prefix: string | null): BoardHealth {
  const h = (prefix && health.get(prefix)) || {};
  return { wifiDbm: h.wifiDbm ?? null, wifiAt: h.wifiAt ?? null, restartedAt: h.restartedAt ?? null };
}
