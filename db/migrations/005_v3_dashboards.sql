-- Nexternel V3 dashboards (Phase 5/6)
-- API also ensures this schema on startup.

CREATE TABLE IF NOT EXISTS v3_dashboards (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    name           VARCHAR(150) NOT NULL,
    document       JSONB NOT NULL DEFAULT '{"schemaVersion":2,"name":"Dashboard","sections":[{"id":"section-main","title":"Main","order":0,"collapsed":false,"widgets":[]}]}'::jsonb,
    is_default     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v3_dashboards_owner ON v3_dashboards(owner_user_id);
