import { getPool } from "../db.js";
import { humanizeTechnicalId, oldHumanizedId } from "./display-name.js";

/** Columns from db/migrations that are not in the original init.sql devices table. */
export async function ensureDevicesSchema(): Promise<void> {
  // An area's icon (an icon id from the UI's icon list; empty = the standard place icon).
  await getPool().query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS icon VARCHAR(40)`);
  await getPool().query(`
    ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await getPool().query(`
    ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS mqtt_availability VARCHAR(16) NOT NULL DEFAULT 'unknown'
  `);
  await getPool().query(`
    UPDATE devices
       SET mqtt_availability = 'online'
     WHERE mqtt_availability = 'unknown'
       AND is_online = TRUE
  `);
}

/**
 * Names Nexternel made from a device's technical ids before it wrote numbers and measurements the usual
 * way ("Pm 2 5" → "PM2.5"). Only a name that is exactly the old automatic form of the end of the
 * reading's own technical id is changed, so a name someone typed is never touched. Safe to run on
 * every start (once repaired, a name no longer matches).
 */
export async function repairAutoSensorNames(): Promise<number> {
  const rows = await getPool().query<{ id: string; name: string; esphome_entity_id: string | null }>(
    `SELECT id, name, esphome_entity_id FROM sensors WHERE esphome_entity_id IS NOT NULL`
  );
  let changed = 0;
  for (const r of rows.rows) {
    const next = repairedName(r.name, r.esphome_entity_id ?? "");
    if (next && next !== r.name) {
      await getPool().query(`UPDATE sensors SET name = $2 WHERE id = $1`, [r.id, next]);
      changed++;
    }
  }
  return changed;
}

/** The repaired name, or null when the name was not made automatically from the id. */
export function repairedName(name: string, entityId: string): string | null {
  const asId = name.trim().toLowerCase().replace(/\s+/g, "_");
  const id = entityId.trim().toLowerCase();
  if (!asId || !(id === asId || id.endsWith(`_${asId}`))) return null;
  if (oldHumanizedId(asId) !== name.trim()) return null;
  const next = humanizeTechnicalId(asId);
  return next === name.trim() ? null : next;
}
