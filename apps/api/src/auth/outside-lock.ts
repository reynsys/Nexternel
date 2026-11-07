import { getPool } from "../db.js";

/**
 * Lock from outside: wrong passwords for an account typed from outside the home are counted.
 * Waiting does not reset the count; only a right sign-in from outside does. At OUTSIDE_LOCK_AFTER
 * the account is locked for signing in from outside until it is unlocked: by the link in the email
 * (when the account has an email address and email sending is set up) or by the home's own
 * administrator in Users. Signing in at home still works while it is locked, so wall screens keep
 * working, but it does not unlock it.
 */

export const OUTSIDE_LOCK_AFTER = 5;
/** The bell says someone is trying, before the lock. */
export const OUTSIDE_WARN_AT = 3;

export async function ensureOutsideLockSchema(): Promise<void> {
  await getPool().query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outside_fails INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS outside_locked_at TIMESTAMPTZ;
  `);
}

/** One more wrong password from outside. */
export async function recordOutsideFail(
  userId: string
): Promise<{ fails: number; justLocked: boolean }> {
  const res = await getPool().query<{ outside_fails: number; just_locked: boolean }>(
    `UPDATE users u
     SET outside_fails = u.outside_fails + 1,
         outside_locked_at = CASE
           WHEN u.outside_locked_at IS NULL AND u.outside_fails + 1 >= $2 THEN NOW()
           ELSE u.outside_locked_at END
     FROM (SELECT id, outside_locked_at AS was_locked FROM users WHERE id = $1) old
     WHERE u.id = old.id
     RETURNING u.outside_fails, (old.was_locked IS NULL AND u.outside_locked_at IS NOT NULL) AS just_locked`,
    [userId, OUTSIDE_LOCK_AFTER]
  );
  const row = res.rows[0];
  return { fails: row?.outside_fails ?? 0, justLocked: Boolean(row?.just_locked) };
}

/** A right sign-in from outside: the count starts again. */
export async function clearOutsideFails(userId: string): Promise<void> {
  await getPool().query(`UPDATE users SET outside_fails = 0 WHERE id = $1 AND outside_fails <> 0`, [userId]);
}

/** Unlock for signing in from outside (administrator or email link). True when it was locked. */
export async function unlockOutside(userId: string): Promise<boolean> {
  const res = await getPool().query(
    `UPDATE users SET outside_fails = 0, outside_locked_at = NULL
     WHERE id = $1 AND (outside_locked_at IS NOT NULL OR outside_fails <> 0)`,
    [userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/** A plain email check: something@something.something, no spaces, not too long. */
export function parseEmail(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  if (v === "") return null;
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return undefined;
  return v;
}
