import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "crypto";
import { config } from "../config.js";

/**
 * Secret plugin settings (keys, passwords) are stored encrypted with a key derived from this
 * server's own secret. Backups carry them decrypted inside the (password-encrypted) backup, so a
 * restore on a new server re-encrypts them with that server's key.
 */
const PREFIX = "enc:v1:";

function settingsKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", config.jwtSecret(), "nexternel", "plugin-settings", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", settingsKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** null when the value cannot be read (e.g. restored from another server without its backup). */
export function decryptSecret(stored: string): string | null {
  if (!stored.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
    const decipher = createDecipheriv("aes-256-gcm", settingsKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Plugin session tokens: shown to the plugin once, stored only as a hash. */
export function newPluginToken(pluginId: string): string {
  return `nxp_${pluginId}_${randomBytes(24).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, storedHash: string | null): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Plugin id from a token, so the doorway can find the row before checking the hash. */
export function pluginIdFromToken(token: string): string | null {
  const m = /^nxp_([a-z0-9-]+)_[\w-]+$/.exec(token);
  return m ? m[1]! : null;
}
