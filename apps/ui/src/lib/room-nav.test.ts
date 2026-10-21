import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomNav, shownRoomNav } from "./room-nav.ts";

test("the room menu defaults to the dock, and narrow screens always use the dock", () => {
  assert.equal(normalizeRoomNav(undefined), "dock");
  assert.equal(normalizeRoomNav("rail"), "rail");
  assert.equal(normalizeRoomNav("sideways"), "dock");
  assert.equal(shownRoomNav("panel", false), "panel");
  assert.equal(shownRoomNav("tabs", true), "dock");
});
