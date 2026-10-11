import assert from "node:assert/strict";
import test from "node:test";
import { panelCapabilityResolverKey } from "./panel-resolver-key.js";
import { ResolverCache } from "./resolver-cache.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test("identical normalized resolver requests share in-flight work", async () => {
  const cache = new ResolverCache();
  const pending = deferred<{ data: string[] }>();
  let calls = 0;
  const loader = () => {
    calls += 1;
    return pending.promise;
  };

  const first = cache.acquire("same", loader);
  const second = cache.acquire("same", loader);
  assert.equal(calls, 1);
  assert.equal(first.promise, second.promise);

  pending.resolve({ data: ["cap-a"] });
  assert.deepEqual((await first.promise).data, ["cap-a"]);
  assert.deepEqual((await second.promise).data, ["cap-a"]);
  first.release();
  second.release();
});

test("forced newer request prevents older result becoming cached", async () => {
  const cache = new ResolverCache();
  const oldRequest = deferred<{ data: string }>();
  const newRequest = deferred<{ data: string }>();

  const oldResult = cache.acquire("scope", () => oldRequest.promise);
  const newResult = cache.acquire(
    "scope",
    () => newRequest.promise,
    { force: true }
  );

  newRequest.resolve({ data: "new" });
  assert.equal((await newResult.promise).data, "new");
  oldRequest.resolve({ data: "old" });
  await oldResult.promise;

  assert.equal(cache.peek<string>("scope")?.data, "new");
  oldResult.release();
  newResult.release();
});

test("forced reload publishes the replacement to every key subscriber", async () => {
  const cache = new ResolverCache();
  const oldRequest = deferred<{ data: string }>();
  const newRequest = deferred<{ data: string }>();
  const published: string[] = [];
  const unsubscribeA = cache.subscribe<string>("scope", (result) => {
    if (result.data) published.push(`a:${result.data}`);
  });
  const unsubscribeB = cache.subscribe<string>("scope", (result) => {
    if (result.data) published.push(`b:${result.data}`);
  });
  const firstConsumer = cache.acquire("scope", () => oldRequest.promise);
  const secondConsumer = cache.acquire("scope", () => oldRequest.promise);
  const forced = cache.acquire(
    "scope",
    () => newRequest.promise,
    { force: true }
  );

  newRequest.resolve({ data: "new-ready" });
  assert.equal((await forced.promise).data, "new-ready");
  assert.equal(cache.peek<string>("scope")?.data, "new-ready");
  assert.deepEqual(published, ["a:new-ready", "b:new-ready"]);

  oldRequest.resolve({ data: "old-ready" });
  await firstConsumer.promise;
  await secondConsumer.promise;
  assert.deepEqual(published, ["a:new-ready", "b:new-ready"]);

  firstConsumer.release();
  secondConsumer.release();
  forced.release();
  unsubscribeA();
  unsubscribeB();
});

test("unsettled resolver aborts after its final consumer releases", async () => {
  const cache = new ResolverCache();
  let aborted = false;
  const lease = cache.acquire("scope", (signal) => {
    signal.addEventListener("abort", () => {
      aborted = true;
    });
    return new Promise<never>(() => undefined);
  });

  lease.release();
  assert.equal(aborted, true);
  assert.equal(cache.entryCount(), 0);
});

test("same-key subscriber keeps a forced replacement alive", async () => {
  const cache = new ResolverCache();
  const initial = cache.acquire("scope", async () => ({ data: "initial" }));
  await initial.promise;
  const unsubscribe = cache.subscribe<string>("scope", () => undefined);
  let replacementAborted = false;
  const pending = deferred<{ data: string }>();
  const replacement = cache.acquire(
    "scope",
    (signal) => {
      signal.addEventListener("abort", () => {
        replacementAborted = true;
      });
      return pending.promise;
    },
    { force: true }
  );

  replacement.release();
  assert.equal(replacementAborted, false);
  pending.resolve({ data: "replacement" });
  assert.equal((await replacement.promise).data, "replacement");

  unsubscribe();
  initial.release();
});

test("settled resolver errors are evicted when unused and retry normally", async () => {
  const cache = new ResolverCache();
  let calls = 0;
  const failed = cache.acquire<string>("scope", async () => {
    calls += 1;
    throw new Error("temporary");
  });
  assert.equal((await failed.promise).status, "error");
  failed.release();
  assert.equal(cache.entryCount(), 0);

  const retried = cache.acquire("scope", async () => {
    calls += 1;
    return { data: "ready" };
  });
  assert.equal((await retried.promise).data, "ready");
  assert.equal(calls, 2);
  retried.release();
});

test("capability resolver identity normalizes scope sets, not Panel id", () => {
  const first = panelCapabilityResolverKey("panel.status", {
    areaIds: ["b", "a"],
    systemIds: ["environment", "climate"],
    groupIds: ["g2", "g1"],
    contentMode: "auto",
  });
  const second = panelCapabilityResolverKey("panel.status", {
    areaIds: ["a", "b"],
    systemIds: ["climate", "environment"],
    groupIds: ["g1", "g2"],
    contentMode: "auto",
  });

  assert.equal(first, second);
  assert.doesNotMatch(first, /widget|panelId|instance/i);
});

test("manual capability order remains part of resolver identity", () => {
  const first = panelCapabilityResolverKey("panel.status", {
    contentMode: "manual",
    capabilityIds: ["a", "b"],
  });
  const second = panelCapabilityResolverKey("panel.status", {
    contentMode: "manual",
    capabilityIds: ["b", "a"],
  });
  assert.notEqual(first, second);
});
