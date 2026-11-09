import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRoomNav, roomNavAtTop, shownRoomNav } from "./room-nav.ts";

test("the room menu defaults to the dock, and phones use their own row at the top", () => {
  assert.equal(normalizeRoomNav(undefined), "dock");
  assert.equal(normalizeRoomNav("rail"), "rail");
  assert.equal(normalizeRoomNav("sideways"), "dock");
  assert.equal(normalizeRoomNav("panel"), "dock");
  assert.equal(shownRoomNav("tabs", true), "phone");
  assert.equal(shownRoomNav("rail", false), "rail");
  assert.equal(roomNavAtTop(shownRoomNav("dock", true)), true);
  assert.equal(roomNavAtTop("tabs"), true);
  assert.equal(roomNavAtTop("dock"), false);
  assert.equal(roomNavAtTop("rail"), false);
});
