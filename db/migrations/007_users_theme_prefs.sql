-- Per-user UI theme defaults (mode, accent, skin)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
