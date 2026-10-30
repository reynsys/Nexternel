import { createHash, createPublicKey, verify, type KeyObject } from "crypto";

/**
 * Paid add-ons (Look packs and later others). The rules here are pure so they can be tested:
 *
 * - A licence is issued by the Nexternel licence server for one server (serverId) and lists the
 *   packs it unlocks. It is signed with the licence server's private key; Nexternel only holds
 *   the public key, so a licence cannot be made up or changed here.
 * - A pack is downloaded from the licence server only with a valid licence. It is signed too
 *   (with the buyer's licence id inside), so a changed or swapped pack is refused.
 */

export type LicencePayload = {
  v: 1;
  /** Licence id (shown to the owner, printed into their packs). */
  lid: string;
  /** The server this licence was issued for. */
  serverId: string;
  /** Pack ids it unlocks; "*" = every pack (the owner's licence). */
  packs: string[];
  /** Who it was sold to (shown in Settings → Extensions). */
  holder?: string;
  /** Issued at / valid until (seconds since 1970). Nexternel re-checks long before it ends. */
  iat: number;
  exp: number;
};

export type AddonManifest = {
  id: string;
  name: string;
  kind: "look";
  version: string;
  description?: string;
  minNexternel?: string;
};

/** What the licence server sends for one pack. */
export type AddonPackage = {
  format: 1;
  manifest: AddonManifest;
  /** The pack's code (an ES module), base64. */
  bundle: string;
  licenceId: string;
  signature: string;
};

const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function publicKeyFrom(spkiBase64: string): KeyObject {
  return createPublicKey({ key: Buffer.from(spkiBase64, "base64"), format: "der", type: "spki" });
}

/** The licence inside a token "<payload>.<signature>", or null when it is not genuine. */
export function readLicence(token: string, keys: KeyObject[]): LicencePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || keys.length === 0) return null;
  const genuine = keys.some((k) => {
    try {
      return verify(null, Buffer.from(body, "utf8"), k, b64urlDecode(sig));
    } catch {
      return false;
    }
  });
  if (!genuine) return null;
  try {
    const p = JSON.parse(b64urlDecode(body).toString("utf8")) as LicencePayload;
    if (p.v !== 1 || typeof p.lid !== "string" || typeof p.serverId !== "string" || !Array.isArray(p.packs)) return null;
    if (typeof p.iat !== "number" || typeof p.exp !== "number") return null;
    return p;
  } catch {
    return null;
  }
}

export type LicenceState = "active" | "expired" | "other-server";

export function licenceState(p: LicencePayload, serverId: string, nowSec: number): LicenceState {
  if (p.serverId !== serverId) return "other-server";
  return p.exp > nowSec ? "active" : "expired";
}

export function licenceCovers(p: LicencePayload, packId: string): boolean {
  return p.packs.includes("*") || p.packs.includes(packId);
}

/** The text a pack's signature covers. Keep in step with the licence server. */
export function packageSigningText(pkg: Pick<AddonPackage, "manifest" | "bundle" | "licenceId">): string {
  const sha = createHash("sha256").update(Buffer.from(pkg.bundle, "base64")).digest("hex");
  return ["nexternel-addon:v1", pkg.manifest.id, pkg.manifest.version, pkg.licenceId, sha, JSON.stringify(pkg.manifest)].join("\n");
}

/** Checks a downloaded pack; returns its code, or the reason it is refused. */
export function checkPackage(
  raw: unknown,
  keys: KeyObject[],
  expect: { packId?: string; licenceId: string }
): { ok: true; pkg: AddonPackage; code: Buffer } | { ok: false; reason: string } {
  const pkg = raw as AddonPackage;
  if (!pkg || pkg.format !== 1 || !pkg.manifest || typeof pkg.bundle !== "string" || typeof pkg.signature !== "string") {
    return { ok: false, reason: "The download is not a Nexternel add-on." };
  }
  const m = pkg.manifest;
  if (!ID.test(m.id) || m.kind !== "look" || typeof m.name !== "string" || typeof m.version !== "string") {
    return { ok: false, reason: "The add-on's description is not valid." };
  }
  if (expect.packId && m.id !== expect.packId) return { ok: false, reason: "A different add-on was sent." };
  if (pkg.licenceId !== expect.licenceId) return { ok: false, reason: "The add-on was made for another licence." };
  const text = packageSigningText(pkg);
  const genuine = keys.some((k) => {
    try {
      return verify(null, Buffer.from(text, "utf8"), k, b64urlDecode(pkg.signature));
    } catch {
      return false;
    }
  });
  if (!genuine) return { ok: false, reason: "The add-on's signature does not match: it was changed or did not come from Nexternel." };
  return { ok: true, pkg, code: Buffer.from(pkg.bundle, "base64") };
}

/** A key as people type it: letters and digits in groups, any case, spaces or dashes. */
export function normalizeLicenceKey(raw: string): string | null {
  const k = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9-]{12,64}$/.test(k) ? k : null;
}
