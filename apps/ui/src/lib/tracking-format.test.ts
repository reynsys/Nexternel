import assert from "node:assert/strict";
import { test } from "node:test";
import { dayRange, duration, periodRange, toDateInput, weekStart } from "./tracking-format.ts";

test("durations read naturally", () => {
  assert.equal(duration(45), "45 min");
  assert.equal(duration(130), "2 h 10 min");
  assert.equal(duration(120), "2 h");
  assert.equal(duration(1500), "1 day 1 h");
  assert.equal(duration(2880), "2 days");
});

test("a day runs from local midnight to the next", () => {
  const { from, to } = dayRange("2026-11-06");
  assert.equal(new Date(from).getHours(), 0);
  assert.equal(new Date(to).getDate(), 7);
  assert.equal(toDateInput(new Date(from)), "2026-11-06");
});

test("weeks start on Monday", () => {
  assert.equal(toDateInput(weekStart(new Date(2026, 10, 6))), "2026-11-02");
  assert.equal(toDateInput(weekStart(new Date(2026, 10, 8))), "2026-11-02");
  assert.equal(toDateInput(weekStart(new Date(2026, 10, 9))), "2026-11-09");
});

test("last week ends where this week starts", () => {
  const r = periodRange("lastWeek", new Date(2026, 10, 6, 12));
  assert.equal(toDateInput(new Date(r.from)), "2026-10-26");
  assert.equal(toDateInput(new Date(r.to)), "2026-11-02");
});
