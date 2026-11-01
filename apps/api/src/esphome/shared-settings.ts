import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { getPool } from "../db.js";
import { publishChange } from "../live/changes.js";
import { esphomeDir } from "../migrate/paths.js";
import { logActivity } from "../activity/activity.js";
import { runEsphomeJob } from "./esphome-jobs.js";
import { updateRun } from "./board-updates.js";

/**
 * Every Nexternel board includes the shared board settings (esphome/packages/). ESPHome only works out
 * a board's newest-software fingerprint when it builds the board, so a change to the shared settings
 * alone (a Nexternel update adding the health report, say) would go unnoticed: every board would still
 * look up to date. Nexternel keeps a fingerprint of the shared settings; when it changes, it has ESPHome
 * build every board once (build only — nothing is sent), after which the boards that need the new
 * software show "Update ready".
 */

const CHECK_EVERY_MS = 10 * 60_000;

export type PrepareRun = { running: boolean; done: number; total: number; current: string | null };
let prepare: PrepareRun = { running: false, done: 0, total: 0, current: null };

export function prepareRun(): PrepareRun {
  return prepare;
}

function sharedFiles(dir: string): string[] {
  return fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).sort();
}

/**
 * A fingerprint of every file in the shared board settings folder. Comment lines and blank lines do not
 * count: editing an explanation (or the What's new list) never makes the boards look out of date.
 */
export function sharedSettingsHash(dir = path.join(esphomeDir(), "packages")): string | null {
  try {
    const files = sharedFiles(dir);
    if (!files.length) return null;
    const h = createHash("sha256");
    for (const f of files) {
      const meaningful = fs
        .readFileSync(path.join(dir, f), "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "" && !l.trimStart().startsWith("#"))
        .join("\n");
      h.update(f).update("\0").update(meaningful).update("\0");
    }
    return `v2:${h.digest("hex")}`;
  } catch {
    return null;
  }
}

/** The newest "What's new" line of the shared settings ("V5.2.168: emergency Wi-Fi hotspot"), or null. */
export function sharedSettingsNews(dir = path.join(esphomeDir(), "packages")): string | null {
  try {
    let last: string | null = null;
    for (const f of sharedFiles(dir)) {
      for (const line of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) {
        const m = /^#\s*-\s*(V\d+(?:\.\d+)*:\s*.+?)\s*$/.exec(line);
        if (m) last = m[1]!;
      }
    }
    return last;
  } catch {
    return null;
  }
}

/** When the shared settings last changed in a way that counts (null when not known). */
export async function sharedSettingsChangedAt(): Promise<Date | null> {
  await getPool().query(`CREATE TABLE IF NOT EXISTS nexternel_state (key VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL)`);
  const r = await getPool().query<{ value: string }>(`SELECT value FROM nexternel_state WHERE key = 'shared_board_settings_changed_at'`);
  if (r.rows[0]) return new Date(r.rows[0].value);
  // Before V5.2.174 only the Activity log knew.
  const a = await getPool()
    .query<{ at: Date }>(`SELECT MAX(at) AS at FROM activity_log WHERE text LIKE 'The shared board settings changed%'`)
    .catch(() => ({ rows: [] as { at: Date }[] }));
  return a.rows[0]?.at ?? null;
}

async function stored(): Promise<string | null> {
  await getPool().query(`CREATE TABLE IF NOT EXISTS nexternel_state (key VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL)`);
  const r = await getPool().query<{ value: string }>(`SELECT value FROM nexternel_state WHERE key = 'shared_board_settings'`);
  return r.rows[0]?.value ?? null;
}

async function setState(key: string, value: string): Promise<void> {
  await getPool().query(
    `INSERT INTO nexternel_state (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value]
  );
}

async function remember(hash: string): Promise<void> {
  await setState("shared_board_settings", hash);
}

/** When the shared settings changed since the last check: build every linked board once. */
export async function checkSharedSettings(): Promise<void> {
  if (prepare.running || updateRun().running) return;
  const now = sharedSettingsHash();
  const kept = await stored();
  if (!now || now === kept) return;
  // Kept the old way (whole files, before V5.2.174): take on the new fingerprint without building
  // anything — moving to the new way changes nothing on the boards.
  if (kept && !kept.startsWith("v2:")) {
    await remember(now);
    return;
  }
  await setState("shared_board_settings_changed_at", new Date().toISOString());
  const boards = await getPool().query<{ name: string; file: string }>(
    `SELECT name, esphome_yaml_path AS file FROM devices
      WHERE COALESCE(firmware_type, 'esphome') = 'esphome' AND is_enabled AND COALESCE(esphome_yaml_path, '') <> ''
      ORDER BY name`
  );
  prepare = { running: true, done: 0, total: boards.rows.length, current: null };
  publishChange("devices");
  void logActivity({ kind: "update", text: `The shared board settings changed: preparing new software for ${boards.rows.length} boards (nothing is sent yet)` });
  let failed = 0;
  for (const b of boards.rows) {
    prepare.current = b.name;
    publishChange("devices");
    const r = await runEsphomeJob("compile", b.file).catch(() => ({ ok: false }));
    if (!r.ok) failed++;
    prepare.done++;
  }
  // Remembered only when every board was built, so a failed build is tried again at the next check.
  if (!failed) await remember(now);
  prepare = { running: false, done: 0, total: 0, current: null };
  publishChange("devices");
  void logActivity({
    kind: "update",
    text: failed ? `New board software prepared, ${failed} board${failed === 1 ? "" : "s"} could not be built (tried again later)` : "New board software prepared — boards that need it show Update ready",
  });
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startSharedSettingsWatch(): void {
  if (timer) return;
  timer = setInterval(() => void checkSharedSettings().catch(() => undefined), CHECK_EVERY_MS);
  timer.unref?.();
  // Shortly after start (an update brings new shared settings with it).
  setTimeout(() => void checkSharedSettings().catch(() => undefined), 2 * 60_000).unref?.();
}
