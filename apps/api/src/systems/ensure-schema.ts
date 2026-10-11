import { SYSTEM_CATALOG } from "@nexternel/domain";
import {
  classifyAllCapabilities,
  syncCapabilityAreasFromDevices,
} from "../capabilities/classify.js";
import { getPool } from "../db.js";

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS systems (
    id              VARCHAR(50) PRIMARY KEY,
    label           VARCHAR(100) NOT NULL,
    tier            VARCHAR(20) NOT NULL DEFAULT 'core',
    sort_order      INT NOT NULL DEFAULT 0,
    plugin_id       VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

ALTER TABLE systems DROP COLUMN IF EXISTS default_view_kind;
`;

async function seedSystemsCatalog(): Promise<void> {
  const pool = getPool();
  for (const entry of SYSTEM_CATALOG) {
    await pool.query(
      `INSERT INTO systems (id, label, tier, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label,
         tier = EXCLUDED.tier,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [entry.id, entry.label, entry.tier, entry.sortOrder]
    );
  }
}

async function backfillCapabilityOwnership(): Promise<{
  areaRows: number;
  systemRows: number;
}> {
  const areaRows = await syncCapabilityAreasFromDevices();
  const systemRows = await classifyAllCapabilities();
  return { areaRows, systemRows };
}

export async function ensureV4DomainSchema(): Promise<{
  areaRows: number;
  systemRows: number;
}> {
  await getPool().query(ENSURE_SQL);
  await seedSystemsCatalog();
  return backfillCapabilityOwnership();
}
