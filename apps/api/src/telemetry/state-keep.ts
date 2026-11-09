import { getPool } from "../db.js";
import { LIVE_CAPABILITY_PRESENCE_MS } from "../devices/presence.js";
import { getAllLiveStates, seedLiveState, type LiveCapabilityState } from "./state-cache.js";

/**
 * The latest readings outlive a restart (an update, a server reboot). Nexternel holds them in memory;
 * this keeps a copy in the database every half minute and when Nexternel stops, and puts them back
 * when it starts — each with the time it really arrived. A reading still recent then counts as
 * current straight away; an older one is "no recent reading", exactly as it would have been without
 * the restart. Without this, every panel lost its value on each update until its board sent again.
 */

const SAVE_EVERY_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;

/** Add-if-missing, so any version can start on any database. */
export async function ensureLiveStateSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS live_states (
      capability_id TEXT PRIMARY KEY,
      value JSONB,
      quality TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
}

/** What a kept reading counts as when it is put back, from its age. */
export function keptQuality(kept: { quality: string; updatedAt: string }, now = Date.now()): LiveCapabilityState["quality"] {
  if (kept.quality !== "good") return kept.quality === "error" ? "error" : "stale";
  return now - Date.parse(kept.updatedAt) <= LIVE_CAPABILITY_PRESENCE_MS ? "good" : "stale";
}

/** Put the kept readings back (before the message service connects). Returns how many. */
export async function restoreKeptStates(): Promise<number> {
  const rows = await getPool().query<{ capability_id: string; value: unknown; quality: string; updated_at: Date }>(
    `SELECT ls.capability_id, ls.value, ls.quality, ls.updated_at
       FROM live_states ls
       JOIN capabilities c ON c.id::text = ls.capability_id`
  );
  const now = Date.now();
  for (const r of rows.rows) {
    const updatedAt = r.updated_at.toISOString();
    seedLiveState({ capabilityId: r.capability_id, value: r.value, updatedAt, quality: keptQuality({ quality: r.quality, updatedAt }, now) });
  }
  return rows.rowCount ?? 0;
}

/** Copy every reading held now into the database. */
export async function saveKeptStates(): Promise<void> {
  const states = getAllLiveStates().filter((s) => s.quality !== "unknown");
  if (states.length === 0) return;
  await getPool().query(
    `INSERT INTO live_states (capability_id, value, quality, updated_at)
     SELECT x.id, x.value, x.quality, x.updated_at
       FROM jsonb_to_recordset($1::jsonb) AS x(id TEXT, value JSONB, quality TEXT, updated_at TIMESTAMPTZ)
     ON CONFLICT (capability_id) DO UPDATE
       SET value = EXCLUDED.value, quality = EXCLUDED.quality, updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(states.map((s) => ({ id: s.capabilityId, value: s.value ?? null, quality: s.quality, updated_at: s.updatedAt })))]
  );
}

/** Save every half minute, and once more when Nexternel is asked to stop (an update or a restart). */
export function startKeepingStates(log: { warn: (obj: unknown, msg: string) => void }): void {
  if (timer) return;
  timer = setInterval(() => void saveKeptStates().catch((err) => log.warn({ err }, "could not keep the latest readings")), SAVE_EVERY_MS);
  timer.unref?.();
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      const stop = () => process.exit(0);
      // Never hold up stopping for long: at most 3 seconds.
      const guard = setTimeout(stop, 3000);
      void saveKeptStates()
        .catch(() => {})
        .finally(() => {
          clearTimeout(guard);
          stop();
        });
    });
  }
}
