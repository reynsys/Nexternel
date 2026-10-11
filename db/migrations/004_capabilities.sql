-- Nexternel V3 — capabilities + MQTT bindings (Phase 3/4)
-- Run on existing servers after upgrade, e.g.:
-- docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < db/migrations/004_capabilities.sql

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
CREATE INDEX IF NOT EXISTS idx_capability_bindings_state_topic ON capability_bindings(state_topic);
