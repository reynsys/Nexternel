import assert from "node:assert/strict";
import test from "node:test";
import { nextPhase } from "./auto-scroll.ts";

test("a long panel waits at the top, scrolls down, waits at the bottom, returns", () => {
  assert.equal(nextPhase("top", 1000, false), "top");
  assert.equal(nextPhase("top", 5000, false), "down");
  assert.equal(nextPhase("down", 100, false), "down");
  assert.equal(nextPhase("down", 100, true), "bottom");
  assert.equal(nextPhase("bottom", 1000, true), "bottom");
  assert.equal(nextPhase("bottom", 4000, true), "top");
});
