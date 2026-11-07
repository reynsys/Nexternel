import { createHash, randomBytes } from "crypto";
import { getPool } from "../db.js";
import { checkCode, lockSecret, newSecret, openSecret } from "./totp.js";

/**
 * Second check (two-step sign-in), optional per account, asked only when signing in from outside.
 * Today: the Authenticator app. A phone can be trusted: it then skips the code until it is removed,
 * goes 90 days unused, or the account is signed out everywhere (new password, Sign out everywhere
 * else, account switched off).
 */

export const TRUSTED_COOKIE = "nx_trusted";
export const TRUSTED_UNUSED_DAYS = 90;

export async function ensureSecondCheckSchema(): Promise<void> {
  await getPool().query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS trusted_screens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS trusted_screens_user ON trusted_screens (user_id);
  `);
}

type Row = { totp_secret: string | null; totp_pending: string | null; totp_last_step: string | null };

async function row(userId: string): Promise<Row | undefined> {
  const res = await getPool().query<Row>(
    `SELECT totp_secret, totp_pending, totp_last_step FROM users WHERE id = $1`,
    [userId]
  );
  return res.rows[0];
}

/** "on": set up; "broken": set up but its key cannot be opened here (restored onto another server). */
export async function secondCheckState(userId: string): Promise<"off" | "on" | "broken"> {
  const r = await row(userId);
  if (!r?.totp_secret) return "off";
  return openSecret(r.totp_secret) ? "on" : "broken";
}

/** Start setting up: a new key, kept aside until the first code proves the app has it. */
export async function startSetup(userId: string): Promise<string> {
  const secret = newSecret();
  await getPool().query(`UPDATE users SET totp_pending = $2 WHERE id = $1`, [userId, lockSecret(secret)]);
  return secret;
}

/** The first code from the app: right → the second check is on. */
export async function confirmSetup(userId: string, code: string, now = Date.now()): Promise<boolean> {
  const r = await row(userId);
  const secret = openSecret(r?.totp_pending);
  if (!secret) return false;
  const step = checkCode(secret, code, now, null);
  if (step === null) return false;
  await getPool().query(
    `UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_last_step = $2, totp_enabled_at = NOW()
     WHERE id = $1`,
    [userId, step]
  );
  return true;
}

/** A code at sign-in (or to turn it off). Each code works once. */
export async function checkSignInCode(userId: string, code: string, now = Date.now()): Promise<boolean> {
  const r = await row(userId);
  const secret = openSecret(r?.totp_secret);
  if (!secret) return false;
  const last = r?.totp_last_step != null ? Number(r.totp_last_step) : null;
  const step = checkCode(secret, code, now, last);
  if (step === null) return false;
  // Only the first of two simultaneous uses of one code wins.
  const res = await getPool().query(
    `UPDATE users SET totp_last_step = $2 WHERE id = $1 AND (totp_last_step IS NULL OR totp_last_step < $2)`,
    [userId, step]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function turnOff(userId: string): Promise<void> {
  await getPool().query(
    `UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_last_step = NULL, totp_enabled_at = NULL WHERE id = $1`,
    [userId]
  );
  await forgetTrustedScreens(userId);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** "Chrome on Android": a short, plain name for a trusted phone in the list. */
export function screenLabel(userAgent: string | undefined): string {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const system = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iPhone or iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return system ? `${browser} on ${system}` : browser;
}

/** Trust this phone: returns the token for its cookie. */
export async function trustScreen(userId: string, userAgent: string | undefined): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getPool().query(
    `INSERT INTO trusted_screens (user_id, token_hash, label) VALUES ($1, $2, $3)`,
    [userId, hashToken(token), screenLabel(userAgent).slice(0, 80)]
  );
  return token;
}

/** Is this cookie a trusted phone of this account (used within 90 days)? Marks it used. */
export async function isTrustedScreen(userId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const res = await getPool().query(
    `UPDATE trusted_screens SET last_used_at = NOW()
     WHERE user_id = $1 AND token_hash = $2 AND last_used_at > NOW() - ($3 || ' days')::interval
     RETURNING id`,
    [userId, hashToken(token), String(TRUSTED_UNUSED_DAYS)]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listTrustedScreens(userId: string) {
  const res = await getPool().query<{ id: string; label: string | null; created_at: Date; last_used_at: Date }>(
    `SELECT id, label, created_at, last_used_at FROM trusted_screens
     WHERE user_id = $1 AND last_used_at > NOW() - ($2 || ' days')::interval
     ORDER BY last_used_at DESC`,
    [userId, String(TRUSTED_UNUSED_DAYS)]
  );
  return res.rows.map((r) => ({
    id: r.id,
    label: r.label ?? "Browser",
    trustedAt: r.created_at.toISOString(),
    lastUsedAt: r.last_used_at.toISOString(),
  }));
}

export async function removeTrustedScreen(userId: string, id: string): Promise<void> {
  await getPool().query(`DELETE FROM trusted_screens WHERE user_id = $1 AND id = $2`, [userId, id]);
}

export async function forgetTrustedScreens(userId: string): Promise<void> {
  await getPool().query(`DELETE FROM trusted_screens WHERE user_id = $1`, [userId]);
}
