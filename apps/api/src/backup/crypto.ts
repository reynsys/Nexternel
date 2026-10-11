import {
  createCipheriv,
  createDecipheriv,
  createHash,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from "crypto";

export const PBKDF2_ITERATIONS = 100_000;
const KEY_LEN = 32;
const IV_LEN = 12;
const SALT_LEN = 32;

export function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LEN, "sha256");
}

export function encryptPayload(password: string, plaintext: Buffer): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(password, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const version = Buffer.alloc(2);
  version.writeUInt16BE(1, 0);
  return Buffer.concat([version, salt, iv, encrypted, tag]);
}

export function decryptPayload(password: string, blob: Buffer): Buffer {
  if (blob.length < 2 + SALT_LEN + IV_LEN + 16 + 1) {
    throw new Error("backup_corrupt");
  }
  const version = blob.readUInt16BE(0);
  if (version !== 1) {
    throw new Error("backup_incompatible");
  }
  let offset = 2;
  const salt = blob.subarray(offset, offset + SALT_LEN);
  offset += SALT_LEN;
  const iv = blob.subarray(offset, offset + IV_LEN);
  offset += IV_LEN;
  const tag = blob.subarray(blob.length - 16);
  const ciphertext = blob.subarray(offset, blob.length - 16);
  const key = deriveKey(password, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("backup_password_invalid");
  }
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
