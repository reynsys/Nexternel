import assert from "node:assert/strict";
import test from "node:test";
import { backupSecretError, backupSecretField, backupSecretKind } from "./backup-file.ts";

test("backups a server made itself open with its backup key", () => {
  assert.equal(backupSecretKind("nexternel-auto-2026-11-02-0646.nexbackup"), "key");
  assert.equal(backupSecretKind("nexternel-manual-2026-11-02-0950 (1).nexbackup"), "key");
  assert.equal(backupSecretField("nexternel-manual-2026-11-02-0950.nexbackup").label, "Backup key");
});

test("a one-off backup opens with the password chosen then", () => {
  assert.equal(backupSecretKind("nexternel-backup-2026-11-02.nexbackup"), "password");
  assert.equal(backupSecretField("nexternel-backup-2026-11-02.nexbackup").label, "Backup password");
});

test("a renamed file or no file asks for either", () => {
  assert.equal(backupSecretKind("my home.nexbackup"), "either");
  assert.equal(backupSecretKind(null), "either");
  assert.equal(backupSecretField(undefined).label, "Backup password or key");
});

test("a wrong password says what this file needs; other errors pass through", () => {
  assert.match(backupSecretError("nexternel-auto-2026-11-02-0646.nexbackup", "Incorrect backup password."), /emergency kit/);
  assert.match(backupSecretError("nexternel-backup-2026-11-02.nexbackup", "Incorrect backup password."), /password chosen/);
  assert.equal(backupSecretError("nexternel-auto-x.nexbackup", "Backup file is damaged."), "Backup file is damaged.");
});
