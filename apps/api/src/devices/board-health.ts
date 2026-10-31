import { getPool } from "../db.js";

/**
 * A board's own health, from readings every Nexternel board sends (esphome/packages/
 * nexternel-device.yaml): its Wi-Fi signal, its time since restart, and which software it runs
 * (its software fingerprint). Not dashboard readings — they show in the device's Connection and
 * Board software parts. A restart is added to the device's connection history.
 */
export type BoardHealth = { wifiDbm: number | null; wifiAt: string | null; restartedAt: string | null };

const health = new Map<string, { wifiDbm?: number; wifiAt?: string; uptimeS?: number; restartedAt?: string }>();

/** The topics, from the readings' names in the shared board file ("WiFi signal" → wifi_signal). */
const HEALTH_TOPIC = /^(.+)\/sensor\/(wifi_signal|uptime)\/state$/;

/**
 * "<prefix>/sensor/software_fingerprint/state": ESPHome's fingerprint of the running software. ESPHome
 * sends text readings under "sensor" too (seen on the boards); "text_sensor" is accepted as well.
 */
const FINGERPRINT_TOPIC = /^(.+)\/(?:text_)?sensor\/software_fingerprint\/state$/;
const fingerprints = new Map<string, string>();

/** Which software a board says it runs (8 hex characters), or null when it does not say (older software). */
export function boardFingerprint(prefix: string | null): string | null {
  return (prefix && fingerprints.get(prefix)) || null;
}

/** How good a Wi-Fi signal is, in words. */
export function signalWord(dbm: number): "good" | "fair" | "weak" | "very weak" {
  if (dbm >= -60) return "good";
  if (dbm >= -70) return "fair";
  if (dbm >= -80) return "weak";
  return "very weak";
}

/** True when the message was a board-health reading (handled here, not a dashboard reading). */
export function applyBoardHealthTopic(topic: string, payload: string, retained: boolean, prefixOf: (topic: string) => string | null): boolean {
  const f = FINGERPRINT_TOPIC.exec(topic);
  if (f) {
    const prefix = prefixOf(topic);
    if (!prefix || prefix !== f[1]) return false;
    // Kept (retained) is fine here: it is what the board said last, and only changes with new software.
    const value = payload.trim().toLowerCase();
    if (/^[0-9a-f]{8}$/.test(value)) fingerprints.set(prefix, value);
    return true;
  }
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
