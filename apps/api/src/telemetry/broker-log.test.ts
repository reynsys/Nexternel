import assert from "node:assert/strict";
import test from "node:test";
import { takeoverWords } from "./broker-log.js";

const MIN = 60_000;

test("a board that came back once is a moment's break, not two devices", () => {
  assert.match(takeoverWords("garden", 0), /lost touch for a moment/);
  assert.match(takeoverWords("garden", 10 * MIN), /lost touch for a moment/);
});

test("the same name pushing itself out again and again points at two devices", () => {
  let words = "";
  for (let i = 0; i < 5; i++) words = takeoverWords("twins", i * 10_000);
  assert.match(words, /two devices are probably using the same name/);
  // Long after, a single takeover is a break again.
  assert.match(takeoverWords("twins", 30 * MIN), /lost touch for a moment/);
});
