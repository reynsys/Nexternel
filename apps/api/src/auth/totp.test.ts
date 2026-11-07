import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base32Decode,
  base32Encode,
  checkCode,
  codeAt,
  lockSecret,
  newSecret,
  openSecret,
  otpauthUrl,
  stepAt,
} from "./totp.js";

// RFC 6238 test key "12345678901234567890" (SHA-1), 8-digit answers from its appendix.
const RFC_KEY = Buffer.from("12345678901234567890", "ascii");

test("codes match the RFC 6238 test numbers", () => {
  assert.equal(codeAt(RFC_KEY, stepAt(59_000), 8), "94287082");
  assert.equal(codeAt(RFC_KEY, stepAt(1111111109_000), 8), "07081804");
  assert.equal(codeAt(RFC_KEY, stepAt(1234567890_000), 8), "89005924");
  assert.equal(codeAt(RFC_KEY, stepAt(20000000000_000), 8), "65353130");
});

test("base32 goes both ways", () => {
  const b = Buffer.from("12345678901234567890", "ascii");
  assert.equal(base32Encode(b), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.deepEqual(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq"), b);
});

test("a typed code is accepted once, also one step early or late", () => {
  const secret = base32Encode(RFC_KEY);
  const now = 1234567890_000;
  const code = codeAt(RFC_KEY, stepAt(now));
  const step = checkCode(secret, code.slice(0, 3) + " " + code.slice(3), now, null);
  assert.equal(step, stepAt(now));
  assert.equal(checkCode(secret, code, now, step), null, "same code again is refused");
  const late = codeAt(RFC_KEY, stepAt(now) - 1);
  assert.equal(checkCode(secret, late, now, null), stepAt(now) - 1);
  const tooOld = codeAt(RFC_KEY, stepAt(now) - 3);
  assert.equal(checkCode(secret, tooOld, now, null), null);
  assert.equal(checkCode(secret, "12345", now, null), null);
});

test("the key is kept locked and opens again", () => {
  const s = newSecret();
  assert.equal(s.length, 32);
  const locked = lockSecret(s);
  assert.ok(!locked.includes(s));
  assert.equal(openSecret(locked), s);
  assert.equal(openSecret(locked.slice(0, -4) + "AAAA"), null);
  assert.equal(openSecret(null), null);
});

test("the app link names Nexternel and the account", () => {
  const url = otpauthUrl("ABCD", "Rey");
  assert.match(url, /^otpauth:\/\/totp\/Nexternel%3ARey\?secret=ABCD&issuer=Nexternel/);
});
