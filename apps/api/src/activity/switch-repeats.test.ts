import assert from "node:assert/strict";
import test from "node:test";
import { BUSY_COUNT, BUSY_WINDOW, SUMMARY_EVERY, SwitchRepeats } from "./switch-repeats.js";

const MIN = 60_000;

test("a switch changing now and then is written every time", () => {
  const r = new SwitchRepeats();
  for (let i = 0; i < 10; i++) assert.equal(r.note("a", i * 30 * MIN).kind, "write");
});

test("a switch changing by itself again and again becomes one line an hour", () => {
  const r = new SwitchRepeats();
  const kinds: string[] = [];
  for (let i = 0; i <= BUSY_COUNT; i++) kinds.push(r.note("a", i * MIN).kind);
  assert.deepEqual(kinds, [...Array(BUSY_COUNT).fill("write"), "busy"]);
  // Every minute for the next hour: counted, then one summary.
  let summary = null;
  for (let t = BUSY_COUNT + 1; t <= BUSY_COUNT + 60; t++) {
    const v = r.note("a", t * MIN);
    if (v.kind === "summary") summary = v;
    else assert.equal(v.kind, "quiet");
  }
  assert.deepEqual(summary, { kind: "summary", count: 60, minutes: 60 });
  assert.ok(SUMMARY_EVERY === 60 * MIN);
});

test("after a quiet spell each change is written again", () => {
  const r = new SwitchRepeats();
  for (let i = 0; i <= BUSY_COUNT; i++) r.note("a", i * MIN);
  assert.equal(r.note("a", (BUSY_COUNT + 1) * MIN).kind, "quiet");
  assert.equal(r.note("a", (BUSY_COUNT + 1) * MIN + BUSY_WINDOW + 1).kind, "write");
});

test("each switch is counted on its own", () => {
  const r = new SwitchRepeats();
  for (let i = 0; i <= BUSY_COUNT; i++) r.note("a", i * MIN);
  assert.equal(r.note("b", 10 * MIN).kind, "write");
});
