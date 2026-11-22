import assert from "node:assert/strict";
import { test } from "node:test";
import { createShellyPresenceCheck, SHELLY_ANSWER_MS, SHELLY_ASK_AGAIN_MS } from "./presence-check.js";

/** Timers run by hand: `advance(ms)` fires every timer due by then. */
function setup(connected = true) {
  let now = 0;
  const timers: { at: number; fn: () => void; dead: boolean }[] = [];
  const asked: string[] = [];
  const gone: string[] = [];
  const check = createShellyPresenceCheck({
    ask: (p) => (asked.push(p), true),
    notThere: (p) => gone.push(p),
    connected: () => connected,
    setTimer: (fn, ms) => {
      const t = { at: now + ms, fn, dead: false };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => ((t as { dead: boolean }).dead = true),
  });
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => !x.dead && x.at <= now)) {
      t.dead = true;
      t.fn();
    }
  };
  return { check, asked, gone, advance };
}

test("no live answer ends offline, after asking twice", () => {
  const { check, asked, gone, advance } = setup();
  check.check("shelly-a");
  assert.deepEqual(asked, ["shelly-a"]);
  advance(SHELLY_ASK_AGAIN_MS);
  assert.deepEqual(asked, ["shelly-a", "shelly-a"]);
  assert.deepEqual(gone, []);
  advance(SHELLY_ANSWER_MS - SHELLY_ASK_AGAIN_MS);
  assert.deepEqual(gone, ["shelly-a"]);
  assert.equal(check.isChecking("shelly-a"), false);
});

test("a live answer ends the check: the Shelly stays online", () => {
  const { check, asked, gone, advance } = setup();
  check.check("shelly-a");
  check.heardLive("shelly-a");
  advance(SHELLY_ANSWER_MS * 2);
  assert.deepEqual(asked, ["shelly-a"]);
  assert.deepEqual(gone, []);
});

test("asked twice in a row starts only one check", () => {
  const { check, asked, gone, advance } = setup();
  check.check("shelly-a");
  check.check("shelly-a");
  advance(SHELLY_ANSWER_MS);
  assert.deepEqual(asked, ["shelly-a", "shelly-a"]);
  assert.deepEqual(gone, ["shelly-a"]);
});

test("no verdict while Nexternel itself is cut off from the message service", () => {
  const { check, gone, advance } = setup(false);
  check.check("shelly-a");
  advance(SHELLY_ANSWER_MS);
  assert.deepEqual(gone, []);
});

test("offline said during the check: nothing more happens", () => {
  const { check, gone, advance } = setup();
  check.check("shelly-a");
  check.saidOffline("shelly-a");
  advance(SHELLY_ANSWER_MS);
  assert.deepEqual(gone, []);
});
