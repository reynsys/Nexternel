import { getPool } from "../db.js";

/** ESPHome Device Builder columns on devices (Phase 1). */
export async function ensureEsphomeBuilderSchema(): Promise<void> {
  await getPool().query(`
    ALTER TABLE devices
      ADD COLUMN IF NOT EXISTS esphome_management_mode VARCHAR(20),
      ADD COLUMN IF NOT EXISTS esphome_lifecycle_state VARCHAR(32),
      ADD COLUMN IF NOT EXISTS esphome_builder_config JSONB,
      ADD COLUMN IF NOT EXISTS esphome_yaml_path VARCHAR(300)
  `);
}
