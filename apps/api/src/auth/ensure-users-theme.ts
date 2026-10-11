import { getPool } from "../db.js";

const ENSURE_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

export async function ensureUsersThemeSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
