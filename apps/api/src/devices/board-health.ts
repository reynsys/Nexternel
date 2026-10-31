import { getPool } from "../db.js";
import { logActivity } from "../activity/activity.js";

/**
 * A board's own health, from what every Nexternel board sends (esphome/packages/nexternel-device.yaml):
 * its health report every minute (<prefix>/health: uptime, why it last restarted, Wi‑Fi strength, how
 * often Wi‑Fi and the message service dropped since then, free memory, software) and its software
 * fingerprint. Boards not updated yet send their Wi‑Fi signal and uptime as two readings instead.
 * Not dashboard readings — they show on the device's Overview and Troubleshooting. A restart goes into
 * the connection history and, with its reason, the Activity log.
 */
export type HealthReport = {
  at: string;
  uptimeS: number;
  rssi: number | null;
  wifiDrops: number | null;
  mqttDrops: number | null;
  heap: number | null;
  heapMin: number | null;
  resetReason: string | null;
  version: string | null;
  /** Where it is on the network: its address, the Wi-Fi access point (BSSID) and channel. */
  ip: string | null;
  accessPoint: string | null;
  channel: number | null;
  /** The last break from the message service: seconds it lasted, and when it ended. */
  lastBreakS: number | null;
  lastBreakEndedAt: string | null;
};

export type BoardHealth = { wifiDbm: number | null; wifiAt: string | null; restartedAt: string | null; report: HealthReport | null };

type State = { wifiDbm?: number; wifiAt?: string; uptimeS?: number; restartedAt?: string; report?: HealthReport };
const health = new Map<string, State>();

/** The old per-minute readings (boards with the earlier shared settings). */
const READING_TOPIC = /^(.+)\/sensor\/(wifi_signal|uptime)\/state$/;
/** The health report. */
const REPORT_TOPIC = /^(.+)\/health$/;
/**
 * "<prefix>/sensor/software_fingerprint/state": ESPHome's fingerprint of the running software. ESPHome
 * sends text readings under "sensor" too (seen on the boards); "text_sensor" is accepted as well.
 */
const FINGERPRINT_TOPIC = /^(.+)\/(?:text_)?sensor\/software_fingerprint\/state$/;
/** The board's own log ("<prefix>/debug"): its warnings and errors go into the Activity log. */
const LOG_TOPIC = /^(.+)\/debug$/;
/** "[W][mqtt:313]: text" (ESPHome), after taking out the colour codes. */
const LOG_LINE = /^\[([WE])\]\[([^\]]+)\]:\s*(.+)$/;
/** The same warning from the same board is written once every 10 minutes at most. */
const lastWarning = new Map<string, number>();
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

/** Why an ESP32 last started (esp_reset_reason), in plain words. */
const ESP32_RESET: Record<number, string> = {
  1: "switched on",
  2: "reset button or pin",
  3: "restarted by its software (an update, a settings change, or no Wi‑Fi for a long time)",
  4: "crashed",
  5: "frozen and restarted by its watchdog",
  6: "frozen and restarted by its watchdog",
  7: "frozen and restarted by its watchdog",
  8: "woke from deep sleep",
  9: "power dip (brownout)",
  10: "restarted by its SDIO host",
  11: "restarted over USB",
  12: "restarted by a debugger",
  13: "restarted (eFuse error)",
  14: "power glitch",
  15: "the processor locked up",
};

/** The reason in words, from an ESP32 number or an ESP8266 text. */
export function resetWords(code: unknown, text: unknown): string | null {
  if (typeof code === "number") return ESP32_RESET[code] ?? `restart reason ${code}`;
  if (typeof text !== "string" || !text.trim()) return null;
  const t = text.toLowerCase();
  if (t.includes("power on")) return "switched on";
  if (t.includes("watchdog")) return "frozen and restarted by its watchdog";
  if (t.includes("exception")) return "crashed";
  if (t.includes("software")) return "restarted by its software (an update, a settings change, or no Wi‑Fi for a long time)";
  if (t.includes("deep")) return "woke from deep sleep";
  if (t.includes("external")) return "reset button or pin";
  return text.trim();
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** A restart: into the connection history (once, at the moment it restarted) and the Activity log. */
function recordRestart(prefix: string, restartedAt: Date, reason: string | null) {
  void (async () => {
    const d = await getPool().query<{ id: string; name: string }>(`SELECT id, name FROM devices WHERE mqtt_topic_prefix = $1`, [prefix]);
    const row = d.rows[0];
    if (!row) return;
    await getPool().query(`INSERT INTO device_connection_events (device_id, state, at) VALUES ($1, 'restart', $2)`, [row.id, restartedAt]);
    await logActivity({ kind: "device", deviceId: row.id, text: `${row.name} restarted${reason ? `: ${reason}` : ""}` });
  })().catch(() => undefined);
}

/** A new uptime: notes the restart time; a drop in uptime means the board restarted. */
function noteUptime(prefix: string, h: State, uptimeS: number, now: number, reason: string | null) {
  const restartedAt = new Date(now - uptimeS * 1000);
  if (h.uptimeS !== undefined && uptimeS + 60 < h.uptimeS) recordRestart(prefix, restartedAt, reason);
  h.uptimeS = uptimeS;
  h.restartedAt = restartedAt.toISOString();
}

/** Which board has which address (from the health reports): the message service names boards by address. */
const addresses = new Map<string, string>();

/** The topic prefix of the board at this address, or null when no report has named it. */
export function boardAtAddress(ip: string): string | null {
  return addresses.get(ip) ?? null;
}

/**
 * A break from the message service the board reports for the first time (it ended since its last
 * report): into the Activity log with how long it lasted — the board's own side of a drop.
 */
function noteBreak(prefix: string, before: HealthReport | null, now: HealthReport) {
  if (now.lastBreakS === null || !now.lastBreakEndedAt) return;
  // The same break as in the last report (a few seconds of clock difference allowed).
  if (before?.lastBreakEndedAt && Math.abs(Date.parse(before.lastBreakEndedAt) - Date.parse(now.lastBreakEndedAt)) < 5_000) return;
  // The first report after Nexternel started does not know whether the break was already logged.
  if (!before) return;
  const wifiKept = before.wifiDrops !== null && now.wifiDrops === before.wifiDrops;
  void (async () => {
    const d = await getPool().query<{ id: string; name: string }>(`SELECT id, name FROM devices WHERE mqtt_topic_prefix = $1`, [prefix]);
    const row = d.rows[0];
    if (!row) return;
    await logActivity({
      kind: "device",
      deviceId: row.id,
      text: `${row.name} says it was cut off from the message service for ${now.lastBreakS} s${wifiKept ? " (its Wi‑Fi stayed connected)" : " (its Wi‑Fi dropped too)"}`,
    });
  })().catch(() => undefined);
}

/** A warning or error in the board's own log (boards with older settings send every line: only these count). */
function noteBoardWarning(prefix: string, payload: string) {
  // eslint-disable-next-line no-control-regex
  const m = LOG_LINE.exec(payload.replace(/\x1b\[[0-9;]*m/g, "").trim());
  if (!m) return;
  const [, level, source, text] = m;
  const key = `${prefix} ${source} ${text}`;
  const now = Date.now();
  if (now - (lastWarning.get(key) ?? 0) < 10 * 60_000) return;
  lastWarning.set(key, now);
  void (async () => {
    const d = await getPool().query<{ id: string; name: string }>(`SELECT id, name FROM devices WHERE mqtt_topic_prefix = $1`, [prefix]);
    const row = d.rows[0];
    if (!row) return;
    await logActivity({ kind: "device", deviceId: row.id, text: `${row.name} reported ${level === "E" ? "an error" : "a warning"} (${source}): ${text!.slice(0, 200)}` });
  })().catch(() => undefined);
}

/** Listeners waiting for a board's next report (Check now). */
const waiting = new Map<string, Set<(r: HealthReport) => void>>();

/** True when the message was the board's own health (handled here, not a dashboard reading). */
export function applyBoardHealthTopic(topic: string, payload: string, retained: boolean, prefixOf: (topic: string) => string | null): boolean {
  const lg = LOG_TOPIC.exec(topic);
  if (lg) {
    const prefix = prefixOf(topic);
    if (!prefix || prefix !== lg[1]) return false;
    if (!retained) noteBoardWarning(prefix, payload);
    return true;
  }

  const f = FINGERPRINT_TOPIC.exec(topic);
  if (f) {
    const prefix = prefixOf(topic);
    if (!prefix || prefix !== f[1]) return false;
    // Kept (retained) is fine here: it is what the board said last, and only changes with new software.
    const value = payload.trim().toLowerCase();
    if (/^[0-9a-f]{8}$/.test(value)) fingerprints.set(prefix, value);
    return true;
  }

  const rep = REPORT_TOPIC.exec(topic);
  if (rep) {
    const prefix = prefixOf(topic);
    if (!prefix || prefix !== rep[1]) return false;
    if (retained) return true;
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return true;
    }
    const now = Date.now();
    const h = health.get(prefix) ?? {};
    const report: HealthReport = {
      at: new Date(now).toISOString(),
      uptimeS: num(j.up) ?? 0,
      rssi: num(j.rssi),
      wifiDrops: num(j.wifi_drops),
      mqttDrops: num(j.mqtt_drops),
      heap: num(j.heap),
      heapMin: num(j.heap_min),
      resetReason: resetWords(j.reset, j.reset_text),
      version: typeof j.ver === "string" ? j.ver : null,
      ip: typeof j.ip === "string" && j.ip ? j.ip : null,
      accessPoint: typeof j.ap === "string" && /^[0-9A-F:]{17}$/i.test(j.ap) ? j.ap.toUpperCase() : null,
      channel: num(j.ch),
      lastBreakS: num(j.brk),
      lastBreakEndedAt: num(j.brk_ago) !== null ? new Date(now - num(j.brk_ago)! * 1000).toISOString() : null,
    };
    if (report.ip) addresses.set(report.ip, prefix);
    noteBreak(prefix, h.report ?? null, report);
    if (report.rssi !== null && report.rssi < 0) {
      h.wifiDbm = Math.round(report.rssi);
      h.wifiAt = report.at;
    }
    if (typeof j.fp === "string" && /^[0-9a-f]{8}$/i.test(j.fp)) fingerprints.set(prefix, j.fp.toLowerCase());
    noteUptime(prefix, h, report.uptimeS, now, report.resetReason);
    h.report = report;
    health.set(prefix, h);
    for (const fn of waiting.get(prefix) ?? []) fn(report);
    waiting.delete(prefix);
    return true;
  }

  const m = READING_TOPIC.exec(topic);
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
    noteUptime(prefix, h, value, now, null);
  }
  health.set(prefix, h);
  return true;
}

export function boardHealth(prefix: string | null): BoardHealth {
  const h = (prefix && health.get(prefix)) || {};
  return { wifiDbm: h.wifiDbm ?? null, wifiAt: h.wifiAt ?? null, restartedAt: h.restartedAt ?? null, report: h.report ?? null };
}

/** Wait (up to `ms`) for the board's next health report — after asking it for one. */
export function nextHealthReport(prefix: string, ms = 10_000): Promise<HealthReport | null> {
  return new Promise((resolve) => {
    const set = waiting.get(prefix) ?? new Set();
    const done = (r: HealthReport | null) => {
      clearTimeout(timer);
      set.delete(done as (r: HealthReport) => void);
      resolve(r);
    };
    const timer = setTimeout(() => done(null), ms);
    set.add(done as (r: HealthReport) => void);
    waiting.set(prefix, set);
  });
}
