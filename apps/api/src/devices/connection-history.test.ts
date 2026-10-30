import assert from "node:assert/strict";
import test from "node:test";
import { summarizeConnection } from "./connection-history.ts";

const now = new Date("2026-10-30T17:00:00Z");
const at = (t: string) => new Date(`2026-10-30T${t}:00Z`);

test("outages in the last day, newest first, with their length", () => {
  const s = summarizeConnection(
    [
      { state: "online", at: at("08:00") },
      { state: "offline", at: at("16:15") },
      { state: "online", at: at("16:16") },
      { state: "offline", at: at("16:30") },
      { state: "online", at: at("16:42") },
    ],
    "online",
    now
  );
  assert.deepEqual(s.outages.map((o) => o.minutes), [12, 1]);
  assert.equal(s.longestMinutes, 12);
  assert.equal(s.state, "online");
  assert.equal(s.since, at("16:42").toISOString());
});

test("an outage still going on counts up to now", () => {
  const s = summarizeConnection([{ state: "online", at: at("10:00") }, { state: "offline", at: at("16:50") }], "offline", now);
  assert.deepEqual(s.outages, [{ from: at("16:50").toISOString(), to: null, minutes: 10 }]);
});

test("no history: state only", () => {
  assert.deepEqual(summarizeConnection([], "online", now), {
    state: "online", since: null, outages: [], longestMinutes: 0, restarts: 0, wifiDbm: null, wifiQuality: null, restartedAt: null,
  });
});

test("restarts are counted, and do not break outages", () => {
  const s = summarizeConnection(
    [{ state: "offline", at: at("16:00") }, { state: "restart", at: at("16:01") }, { state: "online", at: at("16:02") }],
    "online",
    now
  );
  assert.equal(s.restarts, 1);
  assert.deepEqual(s.outages.map((o) => o.minutes), [2]);
});
