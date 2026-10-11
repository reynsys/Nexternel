import assert from "node:assert/strict";
import test from "node:test";
import { octopusRetryDelayMs } from "./poll.js";

const RATE = "Octopus rate limit — wait a minute before testing again (~100 API calls/hour).";
const MIN = 60_000;

test("a rate limit backs off 5 → 10 → 20 → 30 minutes, not every 15 s", () => {
  let backoff = 0;
  const waits: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = octopusRetryDelayMs(RATE, 60_000, backoff);
    backoff = r.rateLimitBackoffMs;
    waits.push(r.delayMs / MIN);
  }
  assert.deepEqual(waits, [5, 10, 20, 30, 30]);
});

test("other failures wait one normal poll interval", () => {
  assert.deepEqual(octopusRetryDelayMs("network down", 60_000, 0), { delayMs: 60_000, rateLimitBackoffMs: 0 });
});
