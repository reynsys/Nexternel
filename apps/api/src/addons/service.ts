import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomUUID, type KeyObject } from "crypto";
import { config } from "../config.js";
import { getPool } from "../db.js";
import { encryptSecret, decryptSecret } from "../plugins/secrets.js";
import { nexternelVersionAtLeast } from "../plugins/validate.js";
import { APP_VERSION } from "../version.js";
import {
  checkPackage,
  licenceCovers,
  licenceState,
  normalizeLicenceKey,
  publicKeyFrom,
  readLicence,
  type AddonManifest,
  type LicencePayload,
} from "./licence.js";

/**
 * Paid add-ons: installed with a licence key from the Nexternel shop, downloaded from the
 * licence server, kept here encrypted (never as readable files) and handed to signed-in
 * browsers only while the licence is valid. Re-checked with the licence server once a day;
 * a licence keeps working offline until it ends (the licence server sets ~30 days).
 */

/**
 * The licence server's public signing keys (licence.nexternel.com). Public on purpose: they can
 * only check licences and packs, never make them.
 */
const PRODUCTION_KEYS: string[] = ["MCowBQYDK2VwAyEAwJ8w47xKOH4nZogiLr+mk2Aa8EAl4PVXKTQ+y3IeW2c="];
const DEFAULT_LICENCE_URL = "https://licence.nexternel.com";

function keys(): KeyObject[] {
  const extra = (process.env.ADDON_PUBLIC_KEY || "").split(",").map((s) => s.trim()).filter(Boolean);
  const out: KeyObject[] = [];
  for (const k of [...PRODUCTION_KEYS, ...extra]) {
    try {
      out.push(publicKeyFrom(k));
    } catch {
      /* skip a malformed key */
    }
  }
  return out;
}

function licenceUrl(): string {
  return (process.env.ADDON_LICENCE_URL || DEFAULT_LICENCE_URL).replace(/\/+$/, "");
}

export function addonsAvailable(): boolean {
  return keys().length > 0;
}

// --- storage --------------------------------------------------------------------------------

export async function ensureAddonSchema(): Promise<void> {
  await getPool().query(`
CREATE TABLE IF NOT EXISTS addons (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  kind           TEXT NOT NULL,
  version        TEXT NOT NULL,
  description    TEXT,
  licence_key    TEXT NOT NULL,
  licence_token  TEXT NOT NULL,
  licence_id     TEXT NOT NULL,
  bundle         BYTEA NOT NULL,
  bundle_sha     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active',
  status_message TEXT,
  installed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at     TIMESTAMPTZ
)`);
}

/** This server's own id: licences are issued for it. Kept in installation_meta. */
export async function serverId(): Promise<string> {
  const pool = getPool();
  const row = await pool.query<{ value: { id?: string } }>(`SELECT value FROM installation_meta WHERE key = 'server_id'`);
  const existing = row.rows[0]?.value?.id;
  if (existing) return existing;
  const id = randomUUID();
  await pool.query(
    `INSERT INTO installation_meta (key, value, updated_at) VALUES ('server_id', $1::jsonb, NOW())
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify({ id })]
  );
  const again = await pool.query<{ value: { id?: string } }>(`SELECT value FROM installation_meta WHERE key = 'server_id'`);
  return again.rows[0]?.value?.id ?? id;
}

// A pack's code is stored encrypted with a key that only this server has.
function codeKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", config.jwtSecret(), "nexternel", "addon-code", 32));
}

function sealCode(code: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", codeKey(), iv);
  const data = Buffer.concat([c.update(code), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]);
}

function openCode(sealed: Buffer): Buffer | null {
  try {
    const d = createDecipheriv("aes-256-gcm", codeKey(), sealed.subarray(0, 12));
    d.setAuthTag(sealed.subarray(12, 28));
    return Buffer.concat([d.update(sealed.subarray(28)), d.final()]);
  } catch {
    return null;
  }
}

type Row = {
  id: string;
  name: string;
  kind: string;
  version: string;
  description: string | null;
  licence_key: string;
  licence_token: string;
  licence_id: string;
  bundle: Buffer;
  bundle_sha: string;
  status: string;
  status_message: string | null;
  installed_at: Date;
  checked_at: Date | null;
};

export type AddonStatus = "active" | "expired" | "revoked" | "broken";

export type AddonInfo = {
  id: string;
  name: string;
  kind: string;
  version: string;
  description: string | null;
  licenceId: string;
  holder: string | null;
  status: AddonStatus;
  message: string | null;
  validUntil: string | null;
  installedAt: string;
  checkedAt: string | null;
};

async function rows(): Promise<Row[]> {
  return (await getPool().query<Row>(`SELECT * FROM addons ORDER BY installed_at`)).rows;
}

/** The state a pack is in right now (its saved status, then its licence). */
async function stateOf(r: Row, sid: string): Promise<{ status: AddonStatus; message: string | null; licence: LicencePayload | null }> {
  if (r.status === "revoked") return { status: "revoked", message: r.status_message, licence: null };
  const licence = readLicence(r.licence_token, keys());
  if (!licence) return { status: "broken", message: "The licence on this server cannot be read. Install the key again.", licence: null };
  const s = licenceState(licence, sid, Math.floor(Date.now() / 1000));
  if (s === "other-server") {
    return { status: "broken", message: "This licence belongs to another server. Install the key again here.", licence };
  }
  if (s === "expired") {
    return { status: "expired", message: "The licence could not be renewed. Check the internet connection, then press Check now.", licence };
  }
  return { status: "active", message: r.status_message, licence };
}

export async function listAddons(): Promise<AddonInfo[]> {
  const sid = await serverId();
  const out: AddonInfo[] = [];
  for (const r of await rows()) {
    const s = await stateOf(r, sid);
    out.push({
      id: r.id,
      name: r.name,
      kind: r.kind,
      version: r.version,
      description: r.description,
      licenceId: r.licence_id,
      holder: s.licence?.holder ?? null,
      status: s.status,
      message: s.message,
      validUntil: s.licence ? new Date(s.licence.exp * 1000).toISOString() : null,
      installedAt: r.installed_at.toISOString(),
      checkedAt: r.checked_at?.toISOString() ?? null,
    });
  }
  return out;
}

/** Packs the browser should load: active ones only. */
export async function activeAddons(): Promise<{ id: string; kind: string; version: string; sha: string }[]> {
  const sid = await serverId();
  const out: { id: string; kind: string; version: string; sha: string }[] = [];
  for (const r of await rows()) {
    if ((await stateOf(r, sid)).status === "active") out.push({ id: r.id, kind: r.kind, version: r.version, sha: r.bundle_sha });
  }
  return out;
}

/** A pack's code for the browser, only while its licence is valid. */
export async function addonCode(id: string): Promise<Buffer | null> {
  const r = (await getPool().query<Row>(`SELECT * FROM addons WHERE id = $1`, [id])).rows[0];
  if (!r) return null;
  if ((await stateOf(r, await serverId())).status !== "active") return null;
  return openCode(r.bundle);
}

// --- talking to the licence server ----------------------------------------------------------

export class AddonError extends Error {}

async function callLicenceServer(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${licenceUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": `Nexternel/${APP_VERSION}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new AddonError("The Nexternel licence server could not be reached. Check this server's internet connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof json.message === "string" ? json.message : `The licence server answered ${res.status}.`;
    throw new AddonError(msg);
  }
  return json;
}

function packFromServer(json: Record<string, unknown>) {
  return json.package;
}

/** Install every pack a licence key unlocks (or update them when already installed). */
export async function installWithKey(rawKey: string): Promise<AddonInfo[]> {
  if (!addonsAvailable()) throw new AddonError("Add-ons are not available on this version of Nexternel yet.");
  const key = normalizeLicenceKey(rawKey);
  if (!key) throw new AddonError("That does not look like a licence key. Copy it exactly from your email.");
  const sid = await serverId();
  const activated = await callLicenceServer("/v1/activate", {
    key,
    serverId: sid,
    // The name people know this server by (as on the local network), not the container's id.
    serverName: `${(process.env.LOCAL_NAME || "nexternel").toLowerCase()}.local`,
    nexternel: APP_VERSION,
  });
  const token = typeof activated.licence === "string" ? activated.licence : "";
  const licence = readLicence(token, keys());
  if (!licence || licenceState(licence, sid, Math.floor(Date.now() / 1000)) !== "active") {
    throw new AddonError("The licence server sent a licence this server cannot use.");
  }
  const packIds = Array.isArray(activated.packs) ? (activated.packs as unknown[]).filter((p): p is string => typeof p === "string") : [];
  if (packIds.length === 0) throw new AddonError("This licence key does not include any add-ons.");

  for (const packId of packIds) {
    if (!licenceCovers(licence, packId)) continue;
    const got = await callLicenceServer("/v1/download", { licence: token, pack: packId });
    const checked = checkPackage(packFromServer(got), keys(), { packId, licenceId: licence.lid });
    if (!checked.ok) throw new AddonError(checked.reason);
    await savePack(checked.pkg.manifest, checked.code, key, token, licence.lid);
  }
  return listAddons();
}

async function savePack(m: AddonManifest, code: Buffer, key: string, token: string, lid: string): Promise<void> {
  if (m.minNexternel && !nexternelVersionAtLeast(APP_VERSION, m.minNexternel)) {
    throw new AddonError(`${m.name} needs Nexternel ${m.minNexternel} or newer. Update Nexternel first.`);
  }
  const sha = createHash("sha256").update(code).digest("hex").slice(0, 16);
  await getPool().query(
    `INSERT INTO addons (id, name, kind, version, description, licence_key, licence_token, licence_id, bundle, bundle_sha, status, status_message, installed_at, checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',NULL,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, version = EXCLUDED.version,
       description = EXCLUDED.description, licence_key = EXCLUDED.licence_key, licence_token = EXCLUDED.licence_token,
       licence_id = EXCLUDED.licence_id, bundle = EXCLUDED.bundle, bundle_sha = EXCLUDED.bundle_sha,
       status = 'active', status_message = NULL, checked_at = NOW()`,
    [m.id, m.name, m.kind, m.version, m.description ?? null, encryptSecret(key), token, lid, sealCode(code), sha]
  );
}

/**
 * Renew every licence with the licence server and fetch newer versions of the packs. Packs keep
 * working when the server cannot be reached, until their licence ends.
 */
export async function checkAddons(): Promise<AddonInfo[]> {
  const all = await rows();
  const byKey = new Map<string, Row[]>();
  for (const r of all) {
    const key = decryptSecret(r.licence_key);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), r]);
  }
  const sid = await serverId();
  for (const [key, packs] of byKey) {
    try {
      const res = await callLicenceServer("/v1/check", { key, serverId: sid, nexternel: APP_VERSION });
      if (res.revoked === true) {
        const why = typeof res.message === "string" ? res.message : "This licence was cancelled.";
        await getPool().query(`UPDATE addons SET status = 'revoked', status_message = $2, checked_at = NOW() WHERE id = ANY($1)`, [
          packs.map((p) => p.id),
          why,
        ]);
        continue;
      }
      const token = typeof res.licence === "string" ? res.licence : "";
      const licence = readLicence(token, keys());
      if (!licence || licenceState(licence, sid, Math.floor(Date.now() / 1000)) !== "active") continue;
      const versions = (res.versions && typeof res.versions === "object" ? res.versions : {}) as Record<string, string>;
      for (const p of packs) {
        if (!licenceCovers(licence, p.id)) {
          await getPool().query(`UPDATE addons SET status = 'revoked', status_message = $2, checked_at = NOW() WHERE id = $1`, [
            p.id,
            "This licence no longer includes this add-on.",
          ]);
          continue;
        }
        if (versions[p.id] && versions[p.id] !== p.version) {
          // A newer version that cannot be installed now (e.g. it needs a newer Nexternel) leaves the
          // current one in place; the licence below is still renewed.
          try {
            const got = await callLicenceServer("/v1/download", { licence: token, pack: p.id });
            const checked = checkPackage(packFromServer(got), keys(), { packId: p.id, licenceId: licence.lid });
            if (checked.ok) {
              await savePack(checked.pkg.manifest, checked.code, key, token, licence.lid);
              continue;
            }
          } catch {
            /* keep the installed version */
          }
        }
        await getPool().query(
          `UPDATE addons SET licence_token = $2, licence_id = $3, status = 'active', status_message = NULL, checked_at = NOW() WHERE id = $1`,
          [p.id, token, licence.lid]
        );
      }
    } catch {
      /* not reachable now: the stored licence keeps working until it ends */
    }
  }
  return listAddons();
}

/** Remove a pack; when no pack of that key is left, give the server's place back to the key. */
export async function removeAddon(id: string): Promise<void> {
  const pool = getPool();
  const r = (await pool.query<Row>(`SELECT * FROM addons WHERE id = $1`, [id])).rows[0];
  if (!r) return;
  await pool.query(`DELETE FROM addons WHERE id = $1`, [id]);
  const key = decryptSecret(r.licence_key);
  if (!key) return;
  const left = (await rows()).some((o) => decryptSecret(o.licence_key) === key);
  if (!left) {
    await callLicenceServer("/v1/deactivate", { key, serverId: await serverId() }).catch(() => undefined);
  }
}

let timer: NodeJS.Timeout | null = null;

/** Once at start (after a minute) and then every day. */
export function startAddonChecks(): void {
  if (timer) return;
  const run = () => void checkAddons().catch(() => undefined);
  setTimeout(run, 60_000);
  timer = setInterval(run, 24 * 60 * 60 * 1000);
}
