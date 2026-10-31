/**
 * Automatic backups: one encrypted backup a day at a chosen hour, the newest N kept in the
 * `backups/` folder beside docker-compose.yml (reachable over FileZilla, copied to USB or a NAS).
 * They are encrypted with this installation's backup key, which the operator downloads once as
 * an "emergency kit" — without it a backup cannot be restored on a new server.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getPool } from "../db.js";
import { APP_VERSION } from "../version.js";
import { createBackupFile } from "./collect.js";

export type BackupSchedule = {
  enabled: boolean;
  hour: number;
  keep: number;
  includeHistory: boolean;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastMessage: string | null;
};

export type StoredBackup = { name: string; sizeBytes: number; createdAt: string; automatic: boolean };

const AUTO_PREFIX = "nexternel-auto-";
const STORED_NAME_RE = /^nexternel-(auto|manual)-\d{4}-\d{2}-\d{2}-\d{4}\.nexbackup$/;
/** Readable key alphabet: no 0/O, 1/I/L. */
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function storedBackupsDir(): string {
  const dir = process.env.BACKUPS_DIR || "/backups";
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** e.g. "K7QM-3XRP-W9TD-HB2C-5NVE-YF4G" (≈ 117 bits). */
export function generateBackupKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < 6; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) s += KEY_ALPHABET[crypto.randomInt(KEY_ALPHABET.length)];
    groups.push(s);
  }
  return groups.join("-");
}

export async function ensureBackupScheduleSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_schedule (
      id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      hour SMALLINT NOT NULL DEFAULT 3,
      keep SMALLINT NOT NULL DEFAULT 7,
      include_history BOOLEAN NOT NULL DEFAULT TRUE,
      backup_key TEXT NOT NULL,
      last_run_at TIMESTAMPTZ,
      last_ok BOOLEAN,
      last_message TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(
    `INSERT INTO backup_schedule (id, backup_key) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
    [generateBackupKey()]
  );
}

type Row = {
  enabled: boolean;
  hour: number;
  keep: number;
  include_history: boolean;
  backup_key: string;
  last_run_at: Date | null;
  last_ok: boolean | null;
  last_message: string | null;
};

async function readRow(): Promise<Row> {
  const res = await getPool().query<Row>(`SELECT * FROM backup_schedule WHERE id = 1`);
  return res.rows[0]!;
}

export async function getBackupSchedule(): Promise<BackupSchedule> {
  const r = await readRow();
  return {
    enabled: r.enabled,
    hour: r.hour,
    keep: r.keep,
    includeHistory: r.include_history,
    lastRunAt: r.last_run_at ? r.last_run_at.toISOString() : null,
    lastOk: r.last_ok,
    lastMessage: r.last_message,
  };
}

export async function getBackupKey(): Promise<string> {
  return (await readRow()).backup_key;
}

export async function updateBackupSchedule(patch: Partial<Pick<BackupSchedule, "enabled" | "hour" | "keep" | "includeHistory">>): Promise<BackupSchedule> {
  const cur = await getBackupSchedule();
  const enabled = patch.enabled ?? cur.enabled;
  const hour = Math.min(23, Math.max(0, Math.round(patch.hour ?? cur.hour)));
  const keep = Math.min(60, Math.max(1, Math.round(patch.keep ?? cur.keep)));
  const includeHistory = patch.includeHistory ?? cur.includeHistory;
  await getPool().query(
    `UPDATE backup_schedule SET enabled = $1, hour = $2, keep = $3, include_history = $4, updated_at = NOW() WHERE id = 1`,
    [enabled, hour, keep, includeHistory]
  );
  return getBackupSchedule();
}

export function isStoredBackupName(name: string): boolean {
  return STORED_NAME_RE.test(name);
}

export function storedBackupPath(name: string): string | null {
  if (!isStoredBackupName(name)) return null;
  const file = path.join(storedBackupsDir(), name);
  return fs.existsSync(file) ? file : null;
}

export function listStoredBackups(): StoredBackup[] {
  const dir = storedBackupsDir();
  return fs
    .readdirSync(dir)
    .filter(isStoredBackupName)
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, sizeBytes: st.size, createdAt: st.mtime.toISOString(), automatic: name.startsWith(AUTO_PREFIX) };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Keep the newest `keep` automatic backups; manual "back up now" files are never pruned. */
export function pruneAutomaticBackups(keep: number): string[] {
  const removed: string[] = [];
  const auto = listStoredBackups().filter((b) => b.automatic);
  for (const old of auto.slice(keep)) {
    fs.rmSync(path.join(storedBackupsDir(), old.name), { force: true });
    removed.push(old.name);
  }
  return removed;
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

let running: Promise<{ ok: boolean; message: string; file?: StoredBackup }> | null = null;

/** Make one backup with the installation key into the backups folder. */
export function runStoredBackup(kind: "auto" | "manual"): Promise<{ ok: boolean; message: string; file?: StoredBackup }> {
  if (running) return running;
  running = (async () => {
    const r = await readRow();
    try {
      const { buffer } = await createBackupFile({ password: r.backup_key, includeHistory: r.include_history });
      const name = `nexternel-${kind}-${stamp()}.nexbackup`;
      fs.writeFileSync(path.join(storedBackupsDir(), name), buffer, { mode: 0o600 });
      const removed = kind === "auto" ? pruneAutomaticBackups(r.keep) : [];
      const sizeMb = (buffer.length / 1_000_000).toFixed(1);
      const message = `Backup ${name} (${sizeMb} MB, ${APP_VERSION})${removed.length ? `; removed ${removed.length} older` : ""}.`;
      await getPool().query(
        `UPDATE backup_schedule SET last_run_at = NOW(), last_ok = TRUE, last_message = $1 WHERE id = 1`,
        [message]
      );
      const file = listStoredBackups().find((b) => b.name === name);
      return { ok: true, message, file };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await getPool().query(
        `UPDATE backup_schedule SET last_run_at = NOW(), last_ok = FALSE, last_message = $1 WHERE id = 1`,
        [message.slice(0, 500)]
      );
      return { ok: false, message };
    } finally {
      running = null;
    }
  })();
  return running;
}

/** True when today's (local time) automatic backup is due and has not run yet. */
export function automaticBackupDue(schedule: Pick<BackupSchedule, "enabled" | "hour" | "lastRunAt">, now = new Date()): boolean {
  if (!schedule.enabled || now.getHours() < schedule.hour) return false;
  if (!schedule.lastRunAt) return true;
  const last = new Date(schedule.lastRunAt);
  const scheduledToday = new Date(now);
  scheduledToday.setHours(schedule.hour, 0, 0, 0);
  return last < scheduledToday;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startBackupScheduler(log: { info: (o: object, m: string) => void; warn: (o: object, m: string) => void }): void {
  if (timer) return;
  const tick = async () => {
    try {
      const schedule = await getBackupSchedule();
      if (!automaticBackupDue(schedule)) return;
      const result = await runStoredBackup("auto");
      (result.ok ? log.info : log.warn)(result, "automatic backup");
      const { logActivity } = await import("../activity/activity.js");
      void logActivity({ kind: "system", text: result.ok ? "Automatic backup made" : `Automatic backup failed: ${result.message}` });
      const { reportAutomaticBackup } = await import("../system/self-check.js");
      await reportAutomaticBackup(result.ok, result.message);
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : String(err) }, "automatic backup check failed");
    }
  };
  timer = setInterval(() => void tick(), 5 * 60_000);
  timer.unref?.();
  setTimeout(() => void tick(), 60_000).unref?.();
}

/** Text the operator keeps somewhere safe — the only way to open the automatic backups. */
export function emergencyKitText(key: string, serverIp: string | null): string {
  return [
    "NEXTERNEL BACKUP EMERGENCY KIT",
    "==============================",
    "",
    "Keep this file somewhere safe and away from the Nexternel server",
    "(password manager, USB stick, printed copy).",
    "",
    `Backup key:   ${key}`,
    "",
    `Created:      ${new Date().toISOString().slice(0, 10)} by ${APP_VERSION}${serverIp ? ` on ${serverIp}` : ""}`,
    "",
    "Automatic backups are saved in the  backups  folder next to docker-compose.yml",
    "(on the server: ~/nexternel/backups). Copy them off the server regularly.",
    "",
    "To restore on a new server: install Nexternel, sign in, open",
    "Settings → Backup & Restore → Restore from a file, choose the .nexbackup file,",
    "and enter the backup key above as the password.",
    "",
    "Without this key the automatic backups cannot be opened.",
    "",
  ].join("\n");
}
