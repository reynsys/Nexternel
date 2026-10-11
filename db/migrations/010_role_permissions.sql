-- Fine-grained permissions on roles
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
