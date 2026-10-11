import { getPool } from "../db.js";

/** Columns from db/migrations that are not in the original init.sql devices table. */
export async function ensureDevicesSchema(): Promise<void> {
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
