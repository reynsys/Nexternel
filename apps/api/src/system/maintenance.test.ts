import assert from "node:assert/strict";
import test from "node:test";
import { clearMaintenanceCache, maintenanceGuard, markRestore } from "./maintenance.js";
import { lastNightlySlot } from "./updates.js";

function fakeReply() {
  const r = { status: 0, body: null as unknown, code(c: number) { r.status = c; return r; }, header() { return r; }, send(b: unknown) { r.body = b; return r; } };
  return r;
}

async function blocked(method: string, url: string): Promise<boolean> {
  const reply = fakeReply();
  await maintenanceGuard({ method, url } as never, reply as never);
  return reply.status === 503;
}

test("during a restore, changes are refused but reading, signing in and switching still work", async () => {
  markRestore("job-1", true);
  clearMaintenanceCache();
  assert.equal(await blocked("PUT", "/api/v1/dashboards/abc"), true);
  assert.equal(await blocked("POST", "/api/v1/plugins/install"), true);
  assert.equal(await blocked("GET", "/api/v1/dashboards/abc"), false);
  assert.equal(await blocked("POST", "/api/v1/auth/login"), false);
  assert.equal(await blocked("POST", "/api/v1/capabilities/123/command"), false);
  assert.equal(await blocked("POST", "/api/v1/plugin-api/readings"), false);
  markRestore("job-1", false);
  clearMaintenanceCache();
});

test("the nightly check time is 01:15 local time", () => {
  const evening = new Date(2026, 9, 13, 22, 0);
  assert.equal(lastNightlySlot(evening).getTime(), new Date(2026, 9, 13, 1, 15).getTime());
  const justBefore = new Date(2026, 9, 13, 1, 10);
  assert.equal(lastNightlySlot(justBefore).getTime(), new Date(2026, 9, 12, 1, 15).getTime());
});
