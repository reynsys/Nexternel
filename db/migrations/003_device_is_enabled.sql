-- Device enable/disable without deleting registration
-- Package version: see VERSION at repo root.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;
