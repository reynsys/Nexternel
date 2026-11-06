import { getPool } from "../db.js";

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS capabilities (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    kind         VARCHAR(50) NOT NULL,
    name         VARCHAR(100) NOT NULL,
    unit         VARCHAR(20),
    source_type  VARCHAR(20) NOT NULL,
    source_id    UUID NOT NULL,
    is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS capability_bindings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capability_id   UUID NOT NULL UNIQUE REFERENCES capabilities(id) ON DELETE CASCADE,
    protocol        VARCHAR(20) NOT NULL DEFAULT 'mqtt',
    state_topic     VARCHAR(300),
    command_topic   VARCHAR(300),
    value_map       JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capabilities_device ON capabilities(device_id);

-- Your own name and icon for a reading. Device syncs never write these.
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS custom_name VARCHAR(100);
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS icon VARCHAR(60);
CREATE INDEX IF NOT EXISTS idx_capability_bindings_state_topic ON capability_bindings(state_topic);

-- Things that do more than on and off: heating, lights, air conditioning. Features say what each can do.
CREATE TABLE IF NOT EXISTS device_controls (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id    UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    slug         VARCHAR(100) NOT NULL,
    control_type VARCHAR(20) NOT NULL,
    features     JSONB NOT NULL DEFAULT '{}',
    command_topic VARCHAR(300) NOT NULL,
    state_topic  VARCHAR(300) NOT NULL,
    is_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (device_id, slug)
);
`;

export async function ensureCapabilitySchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
