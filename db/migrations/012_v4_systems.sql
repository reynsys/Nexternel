-- Nexternel V4 — domain foundation (Phase 1)
-- Systems catalogue, Groups, capability ownership columns
-- Run on existing servers after upgrade, e.g.:
-- docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < db/migrations/012_v4_systems.sql

CREATE TABLE IF NOT EXISTS systems (
    id              VARCHAR(50) PRIMARY KEY,
    label           VARCHAR(100) NOT NULL,
    tier            VARCHAR(20) NOT NULL DEFAULT 'core',
    default_view_kind VARCHAR(80),
    sort_order      INT NOT NULL DEFAULT 0,
    plugin_id       VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO systems (id, label, tier, default_view_kind, sort_order) VALUES
    ('lighting', 'Lighting', 'core', 'view.lighting', 10),
    ('climate', 'Climate', 'core', 'view.climate', 20),
    ('security', 'Security', 'core', 'view.security', 30),
    ('water', 'Water', 'core', 'view.water', 40),
    ('energy', 'Energy', 'core', 'view.energy', 50),
    ('environment', 'Environment', 'core', 'view.environment', 60),
    ('entertainment', 'Entertainment / Media', 'extended', 'view.media', 70),
    ('appliances', 'Appliances', 'extended', 'view.appliances', 80),
    ('garden', 'Garden', 'extended', 'view.garden', 90),
    ('health', 'Health & wellness', 'future', 'view.health', 100),
    ('network', 'Network & IT', 'extended', 'view.network', 110),
    ('vehicles', 'Vehicles & garage', 'extended', 'view.garage', 120)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS groups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id         UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    system_id       VARCHAR(50) NOT NULL REFERENCES systems(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_area_system ON groups(area_id, system_id);

ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS system_id VARCHAR(50) REFERENCES systems(id);
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS service_id VARCHAR(50);
ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_capabilities_system ON capabilities(system_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_area ON capabilities(area_id);
CREATE INDEX IF NOT EXISTS idx_capabilities_group ON capabilities(group_id);

-- Denormalised area from device (API also backfills on startup)
UPDATE capabilities c
SET area_id = d.room_id
FROM devices d
WHERE c.device_id = d.id
  AND c.area_id IS NULL
  AND d.room_id IS NOT NULL;
