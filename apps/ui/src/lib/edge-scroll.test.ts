import assert from "node:assert/strict";
import test from "node:test";
import { edgeSpeed, pointerOf } from "./edge-scroll.ts";

test("the pointer position is read from mouse and touch events", () => {
  assert.deepEqual(pointerOf({ clientX: 3, clientY: 4 }), { x: 3, y: 4 });
  assert.deepEqual(pointerOf({ touches: [{ clientX: 5, clientY: 6 }] }), { x: 5, y: 6 });
  assert.equal(pointerOf({}), null);
});

test("the page scrolls only near the top or bottom edge, faster closer to it, never too fast", () => {
  assert.equal(edgeSpeed(400, 900), 0);
  assert.ok(edgeSpeed(895, 900) > edgeSpeed(860, 900));
  assert.ok(edgeSpeed(860, 900) > 0);
  assert.ok(edgeSpeed(5, 900) < 0);
  assert.ok(edgeSpeed(2000, 900) <= 320);
});
