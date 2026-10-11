import { getPool } from "../db.js";

const ENSURE_SQL = `
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_data TEXT NULL;
`;

export async function ensureUsersAvatarSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}
