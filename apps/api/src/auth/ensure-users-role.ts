import { getPool } from "../db.js";

const ENSURE_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';

UPDATE users
  SET role = 'admin'
  WHERE role IS NULL OR role = '' OR role NOT IN ('admin', 'viewer');
`;

export async function ensureUsersRoleSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
