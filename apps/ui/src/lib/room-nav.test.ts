import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomNav, shownRoomNav } from "./room-nav.ts";

test("the room menu defaults to the dock, and phones use their own way (sheet, swipe, cog in the top bar)", () => {
  assert.equal(normalizeRoomNav(undefined), "dock");
  assert.equal(normalizeRoomNav("rail"), "rail");
  assert.equal(normalizeRoomNav("sideways"), "dock");
  assert.equal(normalizeRoomNav("panel"), "dock");
  assert.equal(shownRoomNav("tabs", true), "phone");
  assert.equal(shownRoomNav("rail", false), "rail");
});
