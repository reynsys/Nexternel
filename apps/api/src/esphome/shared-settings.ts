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

/** A fingerprint of every file in the shared board settings folder. */
export function sharedSettingsHash(dir = path.join(esphomeDir(), "packages")): string | null {
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)).sort();
    if (!files.length) return null;
    const h = createHash("sha256");
    for (const f of files) h.update(f).update("\0").update(fs.readFileSync(path.join(dir, f))).update("\0");
    return h.digest("hex");
  } catch {
    return null;
  }
}

async function stored(): Promise<string | null> {
  await getPool().query(`CREATE TABLE IF NOT EXISTS nexternel_state (key VARCHAR(80) PRIMARY KEY, value TEXT NOT NULL)`);
  const r = await getPool().query<{ value: string }>(`SELECT value FROM nexternel_state WHERE key = 'shared_board_settings'`);
  return r.rows[0]?.value ?? null;
}

async function remember(hash: string): Promise<void> {
  await getPool().query(
    `INSERT INTO nexternel_state (key, value) VALUES ('shared_board_settings', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [hash]
  );
}

/** When the shared settings changed since the last check: build every linked board once. */
export async function checkSharedSettings(): Promise<void> {
  if (prepare.running || updateRun().running) return;
  const now = sharedSettingsHash();
  if (!now || now === (await stored())) return;
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
