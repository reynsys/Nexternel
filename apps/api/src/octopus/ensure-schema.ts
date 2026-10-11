import { getPool } from "../db.js";

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS octopus_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    account_number VARCHAR(32) NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    electricity_device_id VARCHAR(80) NOT NULL DEFAULT '',
    gas_device_id VARCHAR(80) NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    poll_interval_sec INTEGER NOT NULL DEFAULT 60,
    last_poll_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE octopus_settings ADD COLUMN IF NOT EXISTS gas_device_id VARCHAR(80) NOT NULL DEFAULT '';
ALTER TABLE octopus_settings ADD COLUMN IF NOT EXISTS gas_consumption_units VARCHAR(16) NOT NULL DEFAULT '';
`;

export async function ensureOctopusSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
