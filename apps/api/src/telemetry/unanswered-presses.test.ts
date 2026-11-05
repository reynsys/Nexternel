import assert from "node:assert/strict";
import test from "node:test";
import { UNANSWERED_PRESS_MS, UnansweredPresses } from "./unanswered-presses.ts";

test("a late 'on' after an unanswered press is switched back, once", () => {
  const p = new UnansweredPresses();
  p.note("a", 1000);
  assert.equal(p.takeLateOn("a", true, 2000), true);
  assert.equal(p.takeLateOn("a", true, 3000), false);
});

test("an 'off' report keeps waiting: the late 'on' can still come", () => {
  const p = new UnansweredPresses();
  p.note("a", 1000);
  assert.equal(p.takeLateOn("a", false, 2000), false);
  assert.equal(p.takeLateOn("a", true, 3000), true);
});

test("a newer press replaces the unanswered one", () => {
  const p = new UnansweredPresses();
  p.note("a", 1000);
  p.clear("a");
  assert.equal(p.takeLateOn("a", true, 2000), false);
});

test("an 'on' long after the press is not linked to it", () => {
  const p = new UnansweredPresses();
  p.note("a", 1000);
  assert.equal(p.takeLateOn("a", true, 1000 + UNANSWERED_PRESS_MS + 1), false);
});

test("a switch nobody pressed is left alone", () => {
  assert.equal(new UnansweredPresses().takeLateOn("a", true, 1000), false);
});
