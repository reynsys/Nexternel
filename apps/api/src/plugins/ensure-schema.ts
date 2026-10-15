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

ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS grants JSONB NOT NULL DEFAULT '{}';
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS config_rev INTEGER NOT NULL DEFAULT 1;
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'stopped';
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS status_message TEXT;
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS status_at TIMESTAMPTZ;
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS package_sha256 VARCHAR(64);
-- Which of the plugin's messages reach the bell: all, important (keep an eye on it) or none.
ALTER TABLE installed_plugins ADD COLUMN IF NOT EXISTS bell VARCHAR(20) NOT NULL DEFAULT 'important';

-- Example manifests from before V5.2.86 could never run; drop them.
DELETE FROM installed_plugins WHERE builtin = TRUE OR source NOT IN ('catalog', 'file');

CREATE TABLE IF NOT EXISTS plugin_action_log (
    id              BIGSERIAL PRIMARY KEY,
    plugin_id       VARCHAR(100) NOT NULL,
    action          VARCHAR(40) NOT NULL,
    detail          JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plugin_action_log_plugin ON plugin_action_log(plugin_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plugin_panel_content (
    plugin_id       VARCHAR(100) NOT NULL,
    panel_id        VARCHAR(40) NOT NULL,
    title           VARCHAR(200) NOT NULL DEFAULT '',
    body            TEXT NOT NULL DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plugin_id, panel_id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source          VARCHAR(120) NOT NULL,
    source_name     VARCHAR(120) NOT NULL,
    level           VARCHAR(10) NOT NULL DEFAULT 'info',
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS notification_reads (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function ensurePluginSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
