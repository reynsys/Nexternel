import assert from "node:assert/strict";
import test from "node:test";
import { HistoryRequestScheduler } from "./history-scheduler.js";

test("history scheduler shares identical in-flight requests", async () => {
  const scheduler = new HistoryRequestScheduler();
  let calls = 0;
  let finish!: (value: number) => void;
  const pending = new Promise<number>((resolve) => {
    finish = resolve;
  });
  const loader = () => {
    calls += 1;
    return pending;
  };

  const first = scheduler.run("cap-a|24h", loader);
  const second = scheduler.run("cap-a|24h", loader);
  assert.equal(calls, 1);
  assert.equal(first, second);
  assert.equal(scheduler.pendingCount(), 1);

  finish(42);
  assert.equal(await first, 42);
  assert.equal(await second, 42);
  assert.equal(scheduler.pendingCount(), 0);
});

test("different history requests remain independently scheduled", async () => {
  const scheduler = new HistoryRequestScheduler();
  let calls = 0;
  const first = scheduler.run("cap-a|24h", async () => ++calls);
  const second = scheduler.run("cap-b|24h", async () => ++calls);

  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
});
