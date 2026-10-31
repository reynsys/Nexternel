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
  // Connection history: every change of a device's online / offline, recorded by the database itself
  // (whatever part of Nexternel changed it), kept 30 days.
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS device_connection_events (
      id         BIGSERIAL PRIMARY KEY,
      device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      state      VARCHAR(16) NOT NULL,
      at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_device_connection_events ON device_connection_events (device_id, at DESC);
    CREATE OR REPLACE FUNCTION nx_record_device_connection() RETURNS trigger AS $$
    BEGIN
      IF NEW.mqtt_availability IN ('online', 'offline') AND NEW.mqtt_availability IS DISTINCT FROM OLD.mqtt_availability THEN
        INSERT INTO device_connection_events (device_id, state) VALUES (NEW.id, NEW.mqtt_availability);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS nx_device_connection ON devices;
    CREATE TRIGGER nx_device_connection AFTER UPDATE OF mqtt_availability ON devices
      FOR EACH ROW EXECUTE FUNCTION nx_record_device_connection();
  `);
  // Board updates from Nexternel: each board's outcome with everything ESPHome wrote (its last 10 kept).
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS board_update_log (
      id          BIGSERIAL PRIMARY KEY,
      device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      started_at  TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      outcome     VARCHAR(16) NOT NULL,
      message     TEXT NOT NULL,
      log         TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_board_update_log ON board_update_log (device_id, finished_at DESC);
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
