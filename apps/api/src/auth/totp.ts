import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "crypto";
import { config } from "../config.js";

/**
 * The Authenticator app's 6-digit codes (TOTP, RFC 6238: HMAC-SHA1, 30-second steps), as Google and
 * Microsoft Authenticator use them. The account's key is kept locked (AES-256-GCM) with a key made
 * from this installation's own secret, so a copy of the database alone does not give the codes away.
 * That secret is not in backups: after a restore onto a new server, the second check is set up again.
 */

export const STEP_SECONDS = 30;
const DIGITS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("not base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new random key (160 bits, the size the apps expect), as base32. */
export function newSecret(): string {
  return base32Encode(randomBytes(20));
}

/** The code for one 30-second step. */
export function codeAt(secret: Buffer, step: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1]! & 15;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function stepAt(ms: number): number {
  return Math.floor(ms / 1000 / STEP_SECONDS);
}

/**
 * Checks a typed code. Allows one step either side (phone clocks drift a little). Returns the step
 * it matched, so the same code cannot be used twice (`lastStep`: the last step already used).
 */
export function checkCode(
  secretB32: string,
  typed: string,
  nowMs: number,
  lastStep: number | null
): number | null {
  const code = typed.replace(/\D/g, "");
  if (code.length !== DIGITS) return null;
  const secret = base32Decode(secretB32);
  const now = stepAt(nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (lastStep !== null && step <= lastStep) continue;
    const want = Buffer.from(codeAt(secret, step));
    if (timingSafeEqual(want, Buffer.from(code))) return step;
  }
  return null;
}

/** The link that opens the Authenticator app with this account filled in. */
export function otpauthUrl(secretB32: string, accountLabel: string): string {
  const issuer = "Nexternel";
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** "JBSW Y3DP …": easier to type by hand. */
export function groupKey(secretB32: string): string {
  return secretB32.replace(/(.{4})/g, "$1 ").trim();
}

function lockKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", config.jwtSecret(), "nexternel", "second-check", 32));
}

export function lockSecret(secretB32: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", lockKey(), iv);
  const enc = Buffer.concat([c.update(secretB32, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

/** The key, or null when it cannot be opened (e.g. restored onto another server). */
export function openSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [v, iv, tag, enc] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !enc) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", lockKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
