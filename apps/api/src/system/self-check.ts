import fs from "fs";
import { getPool } from "../db.js";
import { addNotification, type NotificationLevel } from "../notifications/service.js";
import { bellTopicOn, getOfflineMinutes, type BellTopic } from "../notifications/topics.js";
import { pruneConnectionHistory } from "../devices/connection-history.js";
import { listDevicesDetailed } from "../devices/service.js";
import { getMqttStatus } from "../telemetry/mqtt.js";
import { storedBackupsDir } from "../backup/scheduled.js";
import { nexternelVersionAtLeast } from "../plugins/validate.js";
import { APP_VERSION } from "../version.js";

/**
 * Nexternel watches itself and tells the bell when something needs the owner: a device that says it
 * went offline, device messages (MQTT) down for a while, the disk nearly full, an automatic backup
 * that failed. Each problem is posted once when it starts, and once more when it is over.
 */

/** Device messages may drop for a moment (restarts); only a longer break is reported. */
const MQTT_DOWN_MS = 5 * 60_000;
/** Free space under this share of the disk (or this many GB) is reported. */
export const DISK_WARN = { share: 0.1, gb: 2 };
export const DISK_ALERT = { share: 0.05, gb: 1 };

const UPDATE_TITLE_RE = /^Nexternel (V\d+(?:\.\d+)*) is available$/;

/** The version an "is available" message is about, or null for any other message. */
export function availableVersionOf(title: string): string | null {
  return UPDATE_TITLE_RE.exec(title)?.[1] ?? null;
}

/** "Nexternel Vx is available" messages for versions already installed are removed. */
export async function clearInstalledUpdateNotices(): Promise<number> {
  const pool = getPool();
  const rows = await pool.query<{ id: string; title: string }>(
    `SELECT id, title FROM notifications WHERE source = 'system' AND title LIKE 'Nexternel V% is available'`
  );
  const stale = rows.rows.filter((r) => {
    const v = availableVersionOf(r.title);
    return v !== null && nexternelVersionAtLeast(APP_VERSION, v);
  });
  if (stale.length) await pool.query(`DELETE FROM notifications WHERE id = ANY($1::uuid[])`, [stale.map((r) => r.id)]);
  return stale.length;
}

/** How full the disk is: "ok", "low" (warning) or "very low" (alert). */
export function diskLevel(freeBytes: number, totalBytes: number): "ok" | "low" | "very-low" {
  if (totalBytes <= 0) return "ok";
  const share = freeBytes / totalBytes;
  const gb = freeBytes / 1e9;
  if (share < DISK_ALERT.share || gb < DISK_ALERT.gb) return "very-low";
  if (share < DISK_WARN.share || gb < DISK_WARN.gb) return "low";
  return "ok";
}

async function post(topic: BellTopic, level: NotificationLevel, title: string, body: string) {
  if (!(await bellTopicOn(topic))) return;
  await addNotification({ source: "system", sourceName: "Nexternel", level, title, body }).catch(() => undefined);
}

/** Like post, unless the same message is already in the bell from the last day (e.g. before a restart). */
async function postOnce(topic: BellTopic, level: NotificationLevel, title: string, body: string) {
  const seen = await getPool().query(
    `SELECT 1 FROM notifications WHERE source = 'system' AND title = $1 AND created_at > NOW() - INTERVAL '1 day' LIMIT 1`,
    [title]
  );
  if (!seen.rowCount) await post(topic, level, title, body);
}

let mqttDownSince: number | null = null;
let mqttReported = false;
let disk: "ok" | "low" | "very-low" | null = null;

const clock = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const minutesText = (m: number) => (m < 1 ? "less than a minute" : `${m} minute${m === 1 ? "" : "s"}`);

/** Whether the bell already has this message (from `since` on): what was reported survives restarts. */
async function alreadyPosted(title: string, since: Date): Promise<boolean> {
  const r = await getPool().query(`SELECT 1 FROM notifications WHERE source = 'system' AND title = $1 AND created_at >= $2 LIMIT 1`, [title, since]);
  return Boolean(r.rowCount);
}

/**
 * Devices from their connection history (device_connection_events): one that has been offline for the
 * chosen time (Settings → Notifications, 5 minutes unless changed) is reported, and its return with how
 * long it was gone. Shorter drops are only in the device's history (Devices → the device).
 */
async function checkDevices(): Promise<void> {
  const wait = await getOfflineMinutes();
  const devices = (await listDevicesDetailed()).filter((d) => d.isEnabled);
  // "Hallway Monitor", "Garden: Relays" — the area only when the name does not already say it.
  const where = (d: (typeof devices)[number]) =>
    d.roomName && !d.name.toLowerCase().includes(d.roomName.toLowerCase()) ? `${d.roomName}: ${d.name}` : d.name;
  const now = Date.now();
  for (const d of devices) {
    const r = await getPool().query<{ off_at: Date; on_at: Date | null }>(
      `SELECT off.at AS off_at,
              (SELECT MIN(e.at) FROM device_connection_events e WHERE e.device_id = off.device_id AND e.state = 'online' AND e.at > off.at) AS on_at
         FROM device_connection_events off
        WHERE off.device_id = $1 AND off.state = 'offline' AND off.at > NOW() - INTERVAL '1 day'
        ORDER BY off.at DESC LIMIT 1`,
      [d.id]
    );
    const outage = r.rows[0];
    if (!outage) continue;
    const wentTitle = `${where(d)} went offline`;
    if (!outage.on_at) {
      const gone = Math.floor((now - outage.off_at.getTime()) / 60_000);
      if (d.connectivityState === "offline" && gone >= wait && !(await alreadyPosted(wentTitle, outage.off_at))) {
        await post(
          "devices",
          "warning",
          wentTitle,
          `Offline since ${clock(outage.off_at)} (${minutesText(gone)}). The device lost its connection: check its power and Wi-Fi. Its readings and switches will not update until it is back.`
        );
      }
    } else if (await alreadyPosted(wentTitle, outage.off_at)) {
      const backTitle = `${where(d)} is back online`;
      if (!(await alreadyPosted(backTitle, outage.off_at))) {
        const gone = Math.round((outage.on_at.getTime() - outage.off_at.getTime()) / 60_000);
        await post("devices", "info", backTitle, `It was offline for ${minutesText(gone)} (${clock(outage.off_at)}–${clock(outage.on_at)}).`);
      }
    }
  }
}

async function checkMqtt(): Promise<void> {
  const connected = getMqttStatus().status === "connected";
  if (connected) {
    if (mqttReported) await post("mqtt", "info", "Device messages are working again", "Readings and switches update again.");
    mqttDownSince = null;
    mqttReported = false;
    return;
  }
  mqttDownSince ??= Date.now();
  if (!mqttReported && Date.now() - mqttDownSince >= MQTT_DOWN_MS) {
    mqttReported = true;
    await post(
      "mqtt",
      "alert",
      "Device messages are not working",
      "Nexternel cannot reach the service that carries device messages (MQTT), so readings and switches do not update. Try Restart under Settings → System → Help & troubleshooting."
    );
  }
}

async function checkDisk(): Promise<void> {
  let level: "ok" | "low" | "very-low";
  let freeGb = 0;
  try {
    const s = fs.statfsSync(storedBackupsDir());
    const free = s.bavail * s.bsize;
    freeGb = free / 1e9;
    level = diskLevel(free, s.blocks * s.bsize);
  } catch {
    return;
  }
  const was = disk;
  disk = level;
  if (was === level) return;
  const free = `${freeGb.toFixed(1)} GB free.`;
  if (level === "very-low") {
    await postOnce("disk", "alert", "The disk is almost full", `${free} Nexternel may stop saving readings and backups. Delete old backups (Settings → Backup & Restore) or free space on the server.`);
  } else if (level === "low" && was !== "very-low") {
    await postOnce("disk", "warning", "The disk is getting full", `${free} Delete old backups (Settings → Backup & Restore) or free space on the server.`);
  } else if (level === "ok" && was !== null) {
    await post("disk", "info", "There is enough disk space again", free);
  }
}

/** Called by the backup scheduler after each automatic backup. */
let backupFailed = false;
export async function reportAutomaticBackup(ok: boolean, message: string): Promise<void> {
  if (!ok) {
    backupFailed = true;
    await post("backup", "alert", "The automatic backup failed", `${message}\nTry Back up now under Settings → Backup & Restore.`);
  } else if (backupFailed) {
    backupFailed = false;
    await post("backup", "info", "Automatic backups work again", message);
  }
}

let timer: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null = null;

export function startSelfCheck(log: { warn: (o: object, m: string) => void }): void {
  if (timer) return;
  void clearInstalledUpdateNotices().catch((err) => log.warn({ err: String(err) }, "clearing old update messages failed"));
  const run = async (checks: (() => Promise<void>)[]) => {
    for (const check of checks) {
      try {
        await check();
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : String(err) }, "self-check failed");
      }
    }
  };
  // Devices every minute (from their recorded history, so nothing is missed between looks);
  // the rest every 5 minutes; old history once every 6 hours.
  let ticks = 0;
  const tick = () => {
    ticks++;
    const checks = [checkDevices];
    if (ticks % 5 === 1) checks.push(checkMqtt, checkDisk);
    if (ticks % 360 === 1) checks.push(pruneConnectionHistory);
    void run(checks);
  };
  // The first look waits until devices have had time to report after a start.
  timer = setTimeout(() => {
    tick();
    timer = setInterval(tick, 60_000);
    timer.unref?.();
  }, 2 * 60_000);
  timer.unref?.();
}
