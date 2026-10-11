import { getPool } from "../db.js";

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS installed_plugins (
    id              VARCHAR(100) PRIMARY KEY,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    builtin         BOOLEAN NOT NULL DEFAULT FALSE,
    source          VARCHAR(20) NOT NULL DEFAULT 'builtin',
    package_path    TEXT,
    manifest        JSONB NOT NULL,
    installed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installed_plugins_enabled ON installed_plugins(enabled);
`;

export async function ensurePluginSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
