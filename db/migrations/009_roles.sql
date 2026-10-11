-- Customizable roles (Administrator / Viewer seeded; more can be added in UI)

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(50) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (slug, name, description, is_admin, is_system, sort_order)
VALUES
  ('admin', 'Administrator', 'Full access — manage users, roles, devices, and settings', TRUE, TRUE, 0),
  ('viewer', 'Viewer', 'Signed-in access without admin privileges', FALSE, TRUE, 10)
ON CONFLICT (slug) DO NOTHING;
