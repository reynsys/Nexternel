-- Dashboard grid layouts and widgets (run on existing servers after upgrade)
-- Package version: see VERSION at repo root.
-- Example: docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < db/migrations/002_dashboard_widgets.sql

CREATE TABLE IF NOT EXISTS dashboard_layouts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL DEFAULT 'default',
    columns     INT NOT NULL DEFAULT 4 CHECK (columns >= 1 AND columns <= 12),
    rows        INT NOT NULL DEFAULT 4 CHECK (rows >= 1 AND rows <= 12),
    is_default  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layout_id   UUID NOT NULL REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(150),
    cell        VARCHAR(10) NOT NULL,
    col_span    INT NOT NULL DEFAULT 1 CHECK (col_span >= 1),
    row_span    INT NOT NULL DEFAULT 1 CHECK (row_span >= 1),
    config      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_layout ON dashboard_widgets(layout_id);

ALTER TABLE dashboard_layouts ADD COLUMN IF NOT EXISTS tab_icon VARCHAR(50) NOT NULL DEFAULT 'layout-dashboard';
ALTER TABLE dashboard_layouts ADD COLUMN IF NOT EXISTS show_tab_label BOOLEAN NOT NULL DEFAULT TRUE;
