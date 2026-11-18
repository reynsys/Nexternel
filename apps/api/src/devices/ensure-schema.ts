import { getPool } from "../db.js";
import { humanizeTechnicalId, oldHumanizedId } from "./display-name.js";

/**
 * How a device from before devices.connection is reached, worked out from its type (SQL on the given
 * firmware column). Used at every start and when a backup from before this field is restored.
 */
export function connectionFromFirmwareSql(firmwareColumn: string): string {
  return `CASE COALESCE(${firmwareColumn}, 'esphome') WHEN 'plugin' THEN 'extension' WHEN 'octopus' THEN 'octopus' ELSE 'mqtt' END`;
}

/** Columns from db/migrations that are not in the original init.sql devices table. */
export async function ensureDevicesSchema(): Promise<void> {
  // An area's icon (an icon id from the UI's icon list; empty = the standard place icon).
  await getPool().query(`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS icon VARCHAR(40)`);
  await getPool().query(`
    ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE
  `);
  // Online / offline for every connection (devices/device-path.ts). It was called mqtt_availability
  // when only MQTT boards had it: renamed once, wherever a home comes from.
  await getPool().query(`
    -- The connection recorder (made again below) still reads the old name.
    DROP TRIGGER IF EXISTS nx_device_connection ON devices;
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'devices' AND column_name = 'mqtt_availability')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'devices' AND column_name = 'availability') THEN
        ALTER TABLE devices RENAME COLUMN mqtt_availability TO availability;
      END IF;
    END $$;
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS availability VARCHAR(16) NOT NULL DEFAULT 'unknown';
  `);
  await getPool().query(`
    UPDATE devices
       SET availability = 'online'
     WHERE availability = 'unknown'
       AND is_online = TRUE
  `);
  // How Nexternel reaches each device (devices/device-path.ts). Devices from before this field are
  // worked out from their type; every new device states it. Only MQTT devices need MQTT addresses.
  await getPool().query(`
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS connection VARCHAR(16);
    UPDATE devices SET connection = ${connectionFromFirmwareSql("firmware_type")} WHERE connection IS NULL;
    ALTER TABLE devices ALTER COLUMN connection SET NOT NULL;
    ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_connection_check;
    ALTER TABLE devices ADD CONSTRAINT devices_connection_check
      CHECK (connection IN ('mqtt', 'extension', 'zherodius', 'octopus'));
    ALTER TABLE devices ALTER COLUMN mqtt_topic_prefix DROP NOT NULL;
    ALTER TABLE sensors ALTER COLUMN mqtt_state_topic DROP NOT NULL;
    ALTER TABLE relays ALTER COLUMN mqtt_state_topic DROP NOT NULL;
    ALTER TABLE relays ALTER COLUMN mqtt_command_topic DROP NOT NULL;
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
      IF NEW.availability IN ('online', 'offline') AND NEW.availability IS DISTINCT FROM OLD.availability THEN
        INSERT INTO device_connection_events (device_id, state) VALUES (NEW.id, NEW.availability);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS nx_device_connection ON devices;
    CREATE TRIGGER nx_device_connection AFTER UPDATE OF availability ON devices
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
    -- Who started the update (a person's name); empty for older records.
    ALTER TABLE board_update_log ADD COLUMN IF NOT EXISTS started_by TEXT;
  `);
}

/**
 * Only MQTT devices have MQTT addresses. Extensions and the Octopus meter were once given made-up ones;
 * this removes them (and any that come back with an old backup). Safe on every start.
 */
export async function clearNonMqttAddresses(): Promise<void> {
  await getPool().query(`
    ALTER TABLE device_controls ALTER COLUMN command_topic DROP NOT NULL;
    ALTER TABLE device_controls ALTER COLUMN state_topic DROP NOT NULL;
    UPDATE devices SET mqtt_topic_prefix = NULL WHERE connection <> 'mqtt' AND mqtt_topic_prefix IS NOT NULL;
    UPDATE sensors s SET mqtt_state_topic = NULL FROM devices d
     WHERE d.id = s.device_id AND d.connection <> 'mqtt' AND s.mqtt_state_topic IS NOT NULL;
    UPDATE relays r SET mqtt_state_topic = NULL, mqtt_command_topic = NULL FROM devices d
     WHERE d.id = r.device_id AND d.connection <> 'mqtt' AND (r.mqtt_state_topic IS NOT NULL OR r.mqtt_command_topic IS NOT NULL);
    UPDATE device_controls dc SET state_topic = NULL, command_topic = NULL FROM devices d
     WHERE d.id = dc.device_id AND d.connection <> 'mqtt' AND (dc.state_topic IS NOT NULL OR dc.command_topic IS NOT NULL);
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
