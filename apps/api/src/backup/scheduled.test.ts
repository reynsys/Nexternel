import assert from "node:assert/strict";
import test from "node:test";
import { automaticBackupDue, generateBackupKey, isStoredBackupName } from "./scheduled.js";

const at = (iso: string) => new Date(iso);

test("the daily backup is due once, at or after the chosen hour", () => {
  const s = { enabled: true, hour: 3 };
  assert.equal(automaticBackupDue({ ...s, lastRunAt: null }, at("2026-10-11T02:59:00")), false); // before 03:00
  assert.equal(automaticBackupDue({ ...s, lastRunAt: null }, at("2026-10-11T03:05:00")), true);
  assert.equal(automaticBackupDue({ ...s, lastRunAt: "2026-10-11T03:05:00" }, at("2026-10-11T09:00:00")), false); // done today
  assert.equal(automaticBackupDue({ ...s, lastRunAt: "2026-10-10T03:05:00" }, at("2026-10-11T09:00:00")), true); // server was off at 03:00
  assert.equal(automaticBackupDue({ enabled: false, hour: 3, lastRunAt: null }, at("2026-10-11T09:00:00")), false);
});

test("backup keys are long, readable, and different every time", () => {
  const a = generateBackupKey();
  assert.match(a, /^([A-HJKMNP-Z2-9]{4}-){5}[A-HJKMNP-Z2-9]{4}$/);
  assert.notEqual(a, generateBackupKey());
});

test("only backup file names are accepted (no paths)", () => {
  assert.equal(isStoredBackupName("nexternel-auto-2026-10-11-0300.nexbackup"), true);
  assert.equal(isStoredBackupName("nexternel-manual-2026-10-11-1412.nexbackup"), true);
  assert.equal(isStoredBackupName("../.env"), false);
  assert.equal(isStoredBackupName("nexternel-auto-2026-10-11-0300.nexbackup/../../x"), false);
});
