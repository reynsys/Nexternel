/**
 * Zherodius direct line, version 2 — the maths, hub side (and the device side, for tests).
 * Pairing: SPAKE2+ (RFC 9383, P256-SHA256-HKDF-SHA256-HMAC-SHA256), the method Matter uses.
 * Every connection: Noise_IK_25519_AESGCM_SHA256 (the Noise Protocol Framework, as in WireGuard).
 *
 * The same steps as Zherodius's reference (ZherodiuS tools/line2.mjs, described in its
 * docs/direct-line.md), checked against the official test vectors in line-crypto.test.ts.
 */
import crypto from "node:crypto";
import { p256 } from "@noble/curves/nist.js";

const P = p256.Point;
type Point = InstanceType<typeof P>;
const n = P.Fn.ORDER;

export const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
export const unhex = (s: string): Buffer => Buffer.from(s, "hex");
const cat = (...a: Uint8Array[]): Buffer => Buffer.concat(a.map((x) => Buffer.from(x)));
const sha256 = (d: Uint8Array): Buffer => crypto.createHash("sha256").update(d).digest();
const hmac = (k: Uint8Array, d: Uint8Array): Buffer => crypto.createHmac("sha256", k).update(d).digest();
const len8 = (b: Uint8Array): Buffer => {
  const l = Buffer.alloc(8);
  l.writeBigUInt64LE(BigInt(b.length));
  return cat(l, b);
};
const toBig = (b: Uint8Array): bigint => BigInt("0x" + (hex(b) || "0"));
const big32 = (x: bigint): Buffer => unhex(x.toString(16).padStart(64, "0"));
const hkdf = (ikm: Uint8Array, info: string, length: number): Buffer =>
  Buffer.from(crypto.hkdfSync("sha256", ikm, Buffer.alloc(0), info, length));

// ---------- SPAKE2+ ----------
const SPAKE_M = P.fromHex("02886e2f97ace46e55ba9dd7242579f2993b64e16ef3dcab95afd497333d8fa12f");
const SPAKE_N = P.fromHex("03d8bbd6c639c62937b04d997f38c3770719c629d7014d49a24b4f98baa1292b49");
export const PAIR_CONTEXT = "Zherodius direct line 2 pairing";
const PBKDF_ITERATIONS = 1000;

/** The pairing code as the owner types it: capitals, no dashes or spaces. */
export function cleanCode(code: string): string {
  return String(code).toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/** w0 and w1 from the pairing code (RFC 9383 §3.2: PBKDF2-HMAC-SHA256, 80 bytes, each half mod n). */
export function spakeSecrets(code: string, salt: Uint8Array, idProver: Uint8Array, idVerifier: Uint8Array) {
  const pw = Buffer.from(cleanCode(code), "utf8");
  const out = crypto.pbkdf2Sync(cat(len8(pw), len8(idProver), len8(idVerifier)), salt, PBKDF_ITERATIONS, 80, "sha256");
  return { w0: toBig(out.subarray(0, 40)) % n, w1: toBig(out.subarray(40)) % n };
}

function randomScalar(): bigint {
  for (;;) {
    const x = toBig(crypto.randomBytes(40)) % n;
    if (x) return x;
  }
}

function transcript(context: string, idP: Uint8Array, idV: Uint8Array, X: Uint8Array, Y: Uint8Array, Z: Uint8Array, V: Uint8Array, w0: bigint) {
  return cat(
    len8(Buffer.from(context)), len8(idP), len8(idV), len8(SPAKE_M.toBytes(false)), len8(SPAKE_N.toBytes(false)),
    len8(X), len8(Y), len8(Z), len8(V), len8(big32(w0))
  );
}

function spakeKeys(tt: Uint8Array) {
  const main = sha256(tt);
  const conf = hkdf(main, "ConfirmationKeys", 64);
  return { main, confirmP: conf.subarray(0, 32), confirmV: conf.subarray(32), shared: hkdf(main, "SharedKey", 32) };
}

function point(b: Uint8Array): Point {
  const p = P.fromBytes(Buffer.from(b));
  p.assertValidity();
  if (p.is0()) throw new Error("bad point");
  return p;
}

export class WrongCodeError extends Error {}

/** The hub (it knows the code). Step 1: shareP. Step 2, with the device's shareV + confirmV: confirmP, or throws. */
export function spakeProver(o: { context?: string; idProver: Uint8Array; idVerifier: Uint8Array; w0: bigint; w1: bigint; x?: bigint }) {
  const context = o.context ?? PAIR_CONTEXT;
  const x = o.x ?? randomScalar();
  const X = P.BASE.multiply(x).add(SPAKE_M.multiply(o.w0)).toBytes(false);
  return {
    shareP: X,
    finish(shareV: Uint8Array, confirmV: Uint8Array) {
      const T = point(shareV).subtract(SPAKE_N.multiply(o.w0));
      if (T.is0()) throw new Error("bad share");
      const Z = T.multiply(x).toBytes(false);
      const V = T.multiply(o.w1).toBytes(false);
      const k = spakeKeys(transcript(context, o.idProver, o.idVerifier, X, shareV, Z, V, o.w0));
      const expected = hmac(k.confirmV, X);
      if (confirmV.length !== expected.length || !crypto.timingSafeEqual(expected, Buffer.from(confirmV))) {
        throw new WrongCodeError("The pairing code is not right.");
      }
      return { confirmP: hmac(k.confirmP, shareV), shared: k.shared, keys: k, Z, V };
    },
  };
}

/** The device's side (written in C in the firmware); here for tests. */
export function spakeVerifier(o: { context?: string; idProver: Uint8Array; idVerifier: Uint8Array; w0: bigint; L: Uint8Array; y?: bigint }, shareP: Uint8Array) {
  const context = o.context ?? PAIR_CONTEXT;
  const y = o.y ?? randomScalar();
  const Y = P.BASE.multiply(y).add(SPAKE_N.multiply(o.w0)).toBytes(false);
  const T = point(shareP).subtract(SPAKE_M.multiply(o.w0));
  if (T.is0()) throw new Error("bad share");
  const Z = T.multiply(y).toBytes(false);
  const V = point(o.L).multiply(y).toBytes(false);
  const k = spakeKeys(transcript(context, o.idProver, o.idVerifier, shareP, Y, Z, V, o.w0));
  return {
    shareV: Y,
    confirmV: hmac(k.confirmV, shareP),
    check: (c: Uint8Array) => c.length === 32 && crypto.timingSafeEqual(hmac(k.confirmP, Y), Buffer.from(c)),
    keys: k,
    Z,
    V,
  };
}
export const spakeL = (w1: bigint): Uint8Array => P.BASE.multiply(w1).toBytes(false);

// ---------- X25519 (Node's own) ----------
const PKCS8 = unhex("302e020100300506032b656e04220420");
const SPKI = unhex("302a300506032b656e032100");
export type X25519Key = { priv: Buffer; pub: Buffer; key: crypto.KeyObject };

export function x25519Key(priv: Uint8Array = crypto.randomBytes(32)): X25519Key {
  const key = crypto.createPrivateKey({ key: cat(PKCS8, priv), format: "der", type: "pkcs8" });
  const pub = crypto.createPublicKey(key).export({ format: "der", type: "spki" }).subarray(-32);
  return { priv: Buffer.from(priv), pub: Buffer.from(pub), key };
}

function dh(mine: X25519Key, theirPub: Uint8Array): Buffer {
  return crypto.diffieHellman({
    privateKey: mine.key,
    publicKey: crypto.createPublicKey({ key: cat(SPKI, theirPub), format: "der", type: "spki" }),
  });
}

// ---------- Noise ----------
const NOISE_NAME = "Noise_IK_25519_AESGCM_SHA256";
export const LINE_PROLOGUE = "Zherodius direct line 2";
const EMPTY = Buffer.alloc(0);

function gcmNonce(nn: bigint): Buffer {
  const b = Buffer.alloc(12);
  b.writeBigUInt64BE(nn, 4);
  return b;
}

/** One direction of an open line: each message under the next counter, so none can be repeated or reordered. */
export class CipherState {
  private n = 0n;
  constructor(private readonly k: Buffer | null) {}
  encrypt(ad: Uint8Array, p: Uint8Array): Buffer {
    if (!this.k) return Buffer.from(p);
    const c = crypto.createCipheriv("aes-256-gcm", this.k, gcmNonce(this.n++));
    c.setAAD(ad);
    return cat(c.update(p), c.final(), c.getAuthTag());
  }
  decrypt(ad: Uint8Array, c: Uint8Array): Buffer {
    if (!this.k) return Buffer.from(c);
    if (c.length < 16) throw new Error("short message");
    const d = crypto.createDecipheriv("aes-256-gcm", this.k, gcmNonce(this.n));
    d.setAAD(ad);
    d.setAuthTag(Buffer.from(c.subarray(c.length - 16)));
    const p = cat(d.update(c.subarray(0, c.length - 16)), d.final());
    this.n++;
    return p;
  }
}

function hkdf2(ck: Uint8Array, ikm: Uint8Array): [Buffer, Buffer] {
  const t = hmac(ck, ikm);
  const o1 = hmac(t, Buffer.from([1]));
  return [o1, hmac(t, cat(o1, Buffer.from([2])))];
}

class Symmetric {
  h: Buffer;
  private ck: Buffer;
  private cs = new CipherState(null);
  constructor(prologue: Uint8Array) {
    const name = Buffer.from(NOISE_NAME);
    this.h = name.length <= 32 ? cat(name, Buffer.alloc(32 - name.length)) : sha256(name);
    this.ck = this.h;
    this.mixHash(prologue);
  }
  mixHash(d: Uint8Array) {
    this.h = sha256(cat(this.h, d));
  }
  mixKey(ikm: Uint8Array) {
    const [ck, k] = hkdf2(this.ck, ikm);
    this.ck = ck;
    this.cs = new CipherState(k);
  }
  encryptAndHash(p: Uint8Array): Buffer {
    const c = this.cs.encrypt(this.h, p);
    this.mixHash(c);
    return c;
  }
  decryptAndHash(c: Uint8Array): Buffer {
    const p = this.cs.decrypt(this.h, c);
    this.mixHash(c);
    return p;
  }
  split(): [CipherState, CipherState] {
    const [a, b] = hkdf2(this.ck, EMPTY);
    return [new CipherState(a), new CipherState(b)];
  }
}

/** The hub opens the line: it knows its own long-term key and the device's long-term public key. */
export function noiseInitiator(o: { s: X25519Key; rs: Uint8Array; e?: X25519Key; prologue?: Uint8Array }) {
  const e = o.e ?? x25519Key();
  const st = new Symmetric(o.prologue ?? Buffer.from(LINE_PROLOGUE));
  st.mixHash(o.rs); // pre-message <- s
  return {
    writeMessage1(payload: Uint8Array = EMPTY): Buffer {
      st.mixHash(e.pub);
      st.mixKey(dh(e, o.rs)); // es
      const encS = st.encryptAndHash(o.s.pub); // s
      st.mixKey(dh(o.s, o.rs)); // ss
      return cat(e.pub, encS, st.encryptAndHash(payload));
    },
    readMessage2(m: Uint8Array) {
      if (m.length < 48) throw new Error("short handshake message");
      const re = m.subarray(0, 32);
      st.mixHash(re);
      st.mixKey(dh(e, re)); // ee
      st.mixKey(dh(o.s, re)); // se
      const payload = st.decryptAndHash(m.subarray(32));
      const [send, recv] = st.split();
      return { payload, send, recv, hash: st.h };
    },
  };
}

/** The device's side (written in C in the firmware); here for tests. */
export function noiseResponder(o: { s: X25519Key; e?: X25519Key; prologue?: Uint8Array }) {
  const e = o.e ?? x25519Key();
  const st = new Symmetric(o.prologue ?? Buffer.from(LINE_PROLOGUE));
  st.mixHash(o.s.pub);
  let re: Uint8Array = EMPTY;
  let rs: Uint8Array = EMPTY;
  return {
    readMessage1(m: Uint8Array) {
      re = m.subarray(0, 32);
      st.mixHash(re);
      st.mixKey(dh(o.s, re)); // es
      rs = st.decryptAndHash(m.subarray(32, 32 + 48)); // s (32 + tag)
      st.mixKey(dh(o.s, rs)); // ss
      return { payload: st.decryptAndHash(m.subarray(80)), hubKey: Buffer.from(rs) };
    },
    writeMessage2(payload: Uint8Array = EMPTY) {
      st.mixHash(e.pub);
      st.mixKey(dh(e, re)); // ee
      st.mixKey(dh(e, rs)); // se
      const message = cat(e.pub, st.encryptAndHash(payload));
      const [recv, send] = st.split();
      return { message, send, recv, hash: st.h };
    },
  };
}
