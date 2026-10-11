import { test } from "node:test";
import assert from "node:assert/strict";
import { decryptPayload, encryptPayload } from "./crypto.js";

test("encrypt/decrypt round-trip", () => {
  const password = "test-password-123";
  const plaintext = Buffer.from("hello nexternel backup");
  const blob = encryptPayload(password, plaintext);
  const out = decryptPayload(password, blob);
  assert.equal(out.toString(), plaintext.toString());
});

test("wrong password fails", () => {
  const blob = encryptPayload("correct-password", Buffer.from("secret"));
  assert.throws(() => decryptPayload("wrong-password", blob), /backup_password_invalid/);
});

test("corrupt blob fails", () => {
  assert.throws(() => decryptPayload("pw", Buffer.from([1, 2, 3])), /backup_corrupt/);
});
