import { EventEmitter } from "events";
import { getPool } from "../db.js";
import { resolveRoleInfo } from "./roles.js";
import type { RolePermissions } from "./permissions.js";

/**
 * "Sign out everywhere else": every login carries the account's sign-in number (token_version).
 * Raising the number makes every earlier login stop working; the screen that asked gets a fresh one.
 * The number also goes up when the password changes, when an administrator sets a new password,
 * and when an account is switched off.
 *
 * Logins checked on every request read the number from a short memory (30 s), so the database is
 * not asked each time; raising it here updates that memory at once.
 */

const CACHE_MS = 30_000;
type RoleNow = { slug: string; isAdmin: boolean; permissions: RolePermissions };
const cache = new Map<string, { version: number; at: number; role?: RoleNow }>();

/** Tells open live connections of an account to close (see telemetry/ws.ts). */
export const signInChanges = new EventEmitter();
signInChanges.setMaxListeners(0);

export async function ensureUsersTokenVersionSchema(): Promise<void> {
  await getPool().query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`
  );
}

/** The account's current number, or null when the account is missing or switched off. */
export async function currentTokenVersion(userId: string): Promise<number | null> {
  const hit = cache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_MS) return hit.version;
  const res = await getPool().query<{ token_version: number; is_active: boolean; role: string }>(
    `SELECT token_version, is_active, role FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const row = res.rows[0];
  const version = row && row.is_active ? row.token_version : -1;
  let role: RoleNow | undefined;
  if (row && row.is_active) {
    const info = await resolveRoleInfo(row.role);
    role = { slug: info.slug, isAdmin: info.isAdmin, permissions: info.permissions };
  }
  cache.set(userId, { version, at: now, role });
  if (cache.size > 5_000) cache.delete(cache.keys().next().value!);
  return version < 0 ? null : version;
}

/**
 * The account's role as it is now (a login carries the role it had when it was made; a change by
 * an administrator applies at once, other role edits within 30 s). Null when the account is gone.
 */
export async function currentRole(userId: string): Promise<RoleNow | null> {
  if ((await currentTokenVersion(userId)) === null) return null;
  return cache.get(userId)?.role ?? null;
}

/** True when a login made with `version` still counts. Old logins without a number count as 0. */
export async function isLoginCurrent(userId: string, version: number | undefined): Promise<boolean> {
  const current = await currentTokenVersion(userId);
  return current !== null && current === (version ?? 0);
}

/** Make every earlier login of this account stop working. Returns the new number. */
export async function raiseTokenVersion(userId: string): Promise<number> {
  const res = await getPool().query<{ token_version: number; is_active: boolean }>(
    `UPDATE users SET token_version = token_version + 1, updated_at = NOW()
     WHERE id = $1 RETURNING token_version, is_active`,
    [userId]
  );
  const row = res.rows[0];
  const version = row ? row.token_version : 0;
  cache.delete(userId);
  signInChanges.emit("changed", userId);
  return version;
}

/** Forget the memory for one account (e.g. after it was switched on or off). */
export function forgetTokenVersion(userId: string): void {
  cache.delete(userId);
}
