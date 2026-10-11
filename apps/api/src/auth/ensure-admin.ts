import { getPool } from "../db.js";
import { hashPassword } from "./tokens.js";

/**
 * Idempotent first-boot admin from ADMIN_USERNAME / ADMIN_PASSWORD.
 * Skips if unset or if the username already exists (does not reset passwords).
 */
export async function ensureAdminFromEnv(): Promise<"created" | "exists" | "skipped"> {
  const username = (process.env.ADMIN_USERNAME || "").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  if (!username || !password) {
    return "skipped";
  }

  const pool = getPool();
  const existing = await pool.query(
    `SELECT id FROM users WHERE username = $1 LIMIT 1`,
    [username]
  );
  if ((existing.rowCount ?? 0) > 0) {
    return "exists";
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role, is_active)
     VALUES ($1, $2, $3, 'admin', true)`,
    [username, passwordHash, "Administrator"]
  );
  return "created";
}
