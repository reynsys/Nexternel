import assert from "node:assert/strict";
import test from "node:test";
import { takeoverWords } from "./broker-log.js";

const MIN = 60_000;

test("a board that came back once is a moment's break, not two devices", () => {
  assert.match(takeoverWords("garden", "10.0.0.5", 0), /lost touch for a moment/);
  assert.match(takeoverWords("garden", "10.0.0.5", 10 * MIN), /lost touch for a moment/);
});

test("the same board pushing itself out again and again cannot hold its connection", () => {
  let words = "";
  for (let i = 0; i < 5; i++) words = takeoverWords("flaky", "10.0.0.5", i * 10_000);
  assert.match(words, /not getting through reliably/);
  assert.doesNotMatch(words, /same name/);
  // Long after, a single takeover is a break again.
  assert.match(takeoverWords("flaky", "10.0.0.5", 30 * MIN), /lost touch for a moment/);
});

test("the same name at different addresses points at two devices", () => {
  let words = "";
  for (let i = 0; i < 5; i++) words = takeoverWords("twins", i % 2 ? "10.0.0.5" : "10.0.0.6", i * 10_000);
  assert.match(words, /two devices at different addresses are using the same name/);
});

test("an unknown address is never taken for a second device", () => {
  let words = "";
  for (let i = 0; i < 5; i++) words = takeoverWords("unknown", i % 2 ? "10.0.0.5" : null, i * 10_000);
  assert.match(words, /not getting through reliably/);
});
