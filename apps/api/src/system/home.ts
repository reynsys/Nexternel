/**
 * Facts about the home as a whole, kept with the installation (installation_meta) and in backups:
 * its name (browser tab, Settings → System) and which terms of use the owner agreed to.
 */
import { getPool } from "../db.js";

export const HOME_NAME_MAX = 60;

export type HomeInfo = { name: string };
export type TermsRecord = { version: string; acceptedAt: string; username: string };

/** A home name as stored: trimmed, single spaces, at most HOME_NAME_MAX characters ("" = none). */
export function normalizeHomeName(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, HOME_NAME_MAX) : "";
}

async function readMeta<T>(key: string): Promise<T | null> {
  const r = await getPool().query<{ value: T }>(`SELECT value FROM installation_meta WHERE key = $1`, [key]);
  return r.rows[0]?.value ?? null;
}

async function writeMeta(key: string, value: unknown): Promise<void> {
  await getPool().query(
    `INSERT INTO installation_meta (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
}

export async function getHome(): Promise<HomeInfo> {
  const v = await readMeta<{ name?: unknown }>("home");
  return { name: normalizeHomeName(v?.name) };
}

export async function setHome(next: { name?: unknown }): Promise<HomeInfo> {
  const home = { name: normalizeHomeName(next.name) };
  await writeMeta("home", home);
  return home;
}

export async function getTermsRecord(): Promise<TermsRecord | null> {
  const v = await readMeta<Partial<TermsRecord>>("terms");
  return v && typeof v.version === "string" && typeof v.acceptedAt === "string"
    ? { version: v.version, acceptedAt: v.acceptedAt, username: typeof v.username === "string" ? v.username : "" }
    : null;
}

export async function recordTermsAccepted(version: string, username: string): Promise<TermsRecord> {
  const rec = { version, acceptedAt: new Date().toISOString(), username };
  await writeTermsRecord(rec);
  return rec;
}

/** Put a terms record back as it was (restore from a backup). */
export async function writeTermsRecord(rec: TermsRecord): Promise<void> {
  await writeMeta("terms", rec);
}
