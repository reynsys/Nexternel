import assert from "node:assert/strict";
import test from "node:test";
import { CapabilityStateStore } from "./capability-store.js";

const state = (value: unknown, second: number) => ({
  value,
  quality: "good",
  updatedAt: `2026-09-14T17:00:${String(second).padStart(2, "0")}.000Z`,
});

test("capability subscriptions only receive selected updates", () => {
  const store = new CapabilityStateStore();
  let aNotifications = 0;
  let zNotifications = 0;
  const stopA = store.subscribe(["a"], () => {
    aNotifications += 1;
  });
  const stopZ = store.subscribe(["z"], () => {
    zNotifications += 1;
  });

  store.apply({ capabilityId: "a", ...state(1, 1) });
  assert.equal(aNotifications, 1);
  assert.equal(zNotifications, 0);

  store.apply({ capabilityId: "z", ...state(2, 2) });
  assert.equal(aNotifications, 1);
  assert.equal(zNotifications, 1);

  stopA();
  stopZ();
  assert.equal(store.listenerCount(), 0);
});

test("identical live state is not published twice", () => {
  const store = new CapabilityStateStore();
  let notifications = 0;
  const stop = store.subscribe(["a"], () => {
    notifications += 1;
  });
  const update = { capabilityId: "a", ...state(1, 1) };

  store.apply(update);
  store.apply(update);

  assert.equal(notifications, 1);
  stop();
});

test("large unrelated update sets do not notify a narrow consumer", () => {
  const store = new CapabilityStateStore();
  let notifications = 0;
  const stop = store.subscribe(["wanted"], () => {
    notifications += 1;
  });

  for (let i = 0; i < 1000; i += 1) {
    store.apply({
      capabilityId: `other-${i}`,
      ...state(i, i % 60),
    });
  }

  assert.equal(notifications, 0);
  stop();
});

test("older live state cannot overwrite a newer state", () => {
  const store = new CapabilityStateStore();
  store.apply({ capabilityId: "a", ...state("new", 20) });
  store.apply({ capabilityId: "a", ...state("old", 10) });

  assert.equal(store.get("a")?.value, "new");
});
