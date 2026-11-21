/**
 * Where each item's readings are kept in history (the history store's two tags: device + entity_id).
 *
 * An item gets its place once and keeps it for good: device syncs, new names and Replace never change
 * it. So when a board moves to another connection (an ESPHome board becomes a Zherodius device) and the
 * new device replaces the old one, the item's new readings go on in the same chart, after the old ones.
 *
 * Items made before places were kept get the place their charts read until then (fillHistoryKeys), so
 * no chart changes when this starts.
 */
import { getPool } from "../db.js";
import type { HistoryKey } from "../devices/device-path.js";
import { resolveHistoryTarget } from "./resolve.js";

const ENSURE_SQL = `
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS history_device VARCHAR(150);
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS history_entity VARCHAR(200);
`;

export async function ensureHistoryKeySchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}

/** Places already looked up, by item id. */
const known = new Map<string, HistoryKey>();

/** The place the item's chart reads when it has none of its own (worked out from its device and source). */
async function workedOutKey(itemId: string): Promise<HistoryKey | null> {
  const r = await resolveHistoryTarget(itemId, { ignoreKept: true });
  return r.ok ? { deviceSlug: r.target.deviceSlug, entityId: r.target.entityId } : null;
}

/** Give the item this place unless it already has one. Gives the place it has after that. */
async function keep(itemId: string, key: HistoryKey): Promise<HistoryKey | null> {
  const r = await getPool().query<{ history_device: string | null; history_entity: string | null }>(
    `UPDATE capabilities SET history_device = COALESCE(history_device, $2), history_entity = COALESCE(history_entity, $3)
     WHERE id = $1
     RETURNING history_device, history_entity`,
    [itemId, key.deviceSlug, key.entityId]
  );
  const row = r.rows[0];
  if (!row?.history_device || !row.history_entity) return null;
  const kept = { deviceSlug: row.history_device, entityId: row.history_entity };
  known.set(itemId, kept);
  return kept;
}

/**
 * Every item with readings that has no place yet gets the one its chart reads today.
 * Runs when Nexternel starts, after a backup is brought back, and before a device replaces another.
 */
export async function fillHistoryKeys(deviceId?: string): Promise<number> {
  known.clear();
  const r = await getPool().query<{ id: string }>(
    `SELECT id FROM capabilities
     WHERE source_type = 'sensor' AND (history_device IS NULL OR history_entity IS NULL)
       AND ($1::uuid IS NULL OR device_id = $1::uuid)`,
    [deviceId ?? null]
  );
  let filled = 0;
  for (const { id } of r.rows) {
    const key = await workedOutKey(id);
    if (key && (await keep(id, key))) filled++;
  }
  return filled;
}

/**
 * Where a new reading of this item is kept: the item's own place. An item that has none yet (a new
 * item, first reading) gets the place its chart would read, or else the one its connection suggests.
 */
export async function historyKeyForReading(itemId: string, suggested: HistoryKey): Promise<HistoryKey | null> {
  const cached = known.get(itemId);
  if (cached) return cached;
  return keep(itemId, (await workedOutKey(itemId)) ?? suggested);
}

/** Forget looked-up places (a backup was brought back, so items may have other places now). */
export function forgetHistoryKeys(): void {
  known.clear();
}
