import { getPool } from "./db.js";

const SETUP_KEY = "setup_completed";

export async function ensureInstallationSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
CREATE TABLE IF NOT EXISTS installation_meta (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
}

export async function isSetupComplete(): Promise<boolean> {
  const pool = getPool();
  const row = await pool.query<{ value: { completed?: boolean } }>(
    `SELECT value FROM installation_meta WHERE key = $1 LIMIT 1`,
    [SETUP_KEY]
  );
  return row.rows[0]?.value?.completed === true;
}

export async function markSetupComplete(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO installation_meta (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = NOW()`,
    [SETUP_KEY, JSON.stringify({ completed: true, completedAt: new Date().toISOString() })]
  );
}

export async function getUserCount(): Promise<number> {
  const pool = getPool();
  const row = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users WHERE is_active = true`
  );
  return Number(row.rows[0]?.count ?? 0);
}

/** Existing installs: mark complete when users already exist. */
export async function bootstrapInstallationState(): Promise<{
  needsSetup: boolean;
  userCount: number;
}> {
  await ensureInstallationSchema();
  const userCount = await getUserCount();
  if (userCount > 0 && !(await isSetupComplete())) {
    await markSetupComplete();
  }
  const needsSetup = userCount === 0 && !(await isSetupComplete());
  return { needsSetup, userCount };
}
