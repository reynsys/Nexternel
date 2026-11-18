import assert from "node:assert/strict";
import test from "node:test";
import { fullDate, fullDateTime } from "./full-date.ts";

test("a moment is written in full, never as Today", () => {
  const now = new Date();
  now.setHours(10, 37, 0, 0);
  const text = fullDateTime(now, "en-GB");
  assert.doesNotMatch(text, /Today|Yesterday/);
  assert.match(text, /^[A-Z][a-z]+day \d{1,2} [A-Z][a-z]+ \d{4}, 10:37$/);
});

test("the agreed form: weekday, day, month, year, then the time", () => {
  assert.equal(fullDateTime(new Date(2026, 10, 18, 10, 37), "en-GB"), "Wednesday 18 November 2026, 10:37");
  assert.equal(fullDate(new Date(2026, 0, 4, 23, 5), "en-GB"), "Sunday 4 January 2026");
});

test("the order stays the same in another language", () => {
  assert.equal(fullDate(new Date(2026, 10, 18), "en-US"), "Wednesday 18 November 2026");
});
