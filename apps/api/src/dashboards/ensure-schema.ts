import { getPool } from "../db.js";

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS v3_dashboards (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    name           VARCHAR(150) NOT NULL,
    document       JSONB NOT NULL DEFAULT '{"schemaVersion":3,"name":"Dashboard","sections":[{"id":"section-main","title":"Main","order":0,"collapsed":false,"panels":[]}]}'::jsonb,
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v3_dashboards_owner ON v3_dashboards(owner_user_id);
`;

const TAB_ORDER_SQL = `
ALTER TABLE v3_dashboards
  ADD COLUMN IF NOT EXISTS tab_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_v3_dashboards_tab_order ON v3_dashboards(tab_order);
`;

export async function ensureDashboardSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
  await getPool().query(TAB_ORDER_SQL);
  // Every dashboard is for everyone on this Nexternel (wall screens, other people). Dashboards made
  // with "New dashboard" used to be kept for their maker only, without saying so; the column is added
  // once, "everyone" for every dashboard — a later "only me" choice can set it false.
  await getPool().query(`ALTER TABLE v3_dashboards ADD COLUMN IF NOT EXISTS visible_to_all BOOLEAN NOT NULL DEFAULT TRUE`);
  // Exactly one start dashboard (address "/"). A restore onto a Nexternel that already had dashboards
  // used to leave two marked, and the second could then never be opened from the room menu or a swipe.
  // Keep the first in the room menu, then let the database refuse a second mark.
  await getPool().query(`
    UPDATE v3_dashboards SET is_default = FALSE
    WHERE is_default = TRUE
      AND id <> (SELECT id FROM v3_dashboards WHERE is_default = TRUE ORDER BY tab_order ASC, created_at ASC LIMIT 1)
  `);
  await getPool().query(`CREATE UNIQUE INDEX IF NOT EXISTS v3_dashboards_one_default ON v3_dashboards ((TRUE)) WHERE is_default`);
  // One-time style backfill: rows still at 0 get creation order (default first).
  await getPool().query(`
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY is_default DESC, created_at ASC) - 1 AS rn
      FROM v3_dashboards
    )
    UPDATE v3_dashboards d
    SET tab_order = numbered.rn
    FROM numbered
    WHERE d.id = numbered.id
      AND d.tab_order = 0
      AND (SELECT COUNT(*) FROM v3_dashboards WHERE tab_order > 0) = 0
  `);
}
