import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhoneRoomNav, normalizeRoomNav, roomNavAtTop, shownRoomNav } from "./room-nav.ts";

test("the room menu defaults to the dock; phones have their own choice, the dock first", () => {
  assert.equal(normalizeRoomNav(undefined), "dock");
  assert.equal(normalizeRoomNav("rail"), "rail");
  assert.equal(normalizeRoomNav("sideways"), "dock");
  assert.equal(normalizeRoomNav("panel"), "dock");
  assert.equal(shownRoomNav("tabs", true), "phone");
  assert.equal(shownRoomNav("rail", false), "rail");
  assert.equal(shownRoomNav("tabs", true, "dock"), "phone");
  assert.equal(shownRoomNav("dock", true, "row"), "phone-row");
  assert.equal(normalizePhoneRoomNav(undefined), "dock");
  assert.equal(normalizePhoneRoomNav("row"), "row");
  assert.equal(roomNavAtTop(shownRoomNav("dock", true)), false);
  assert.equal(roomNavAtTop("phone-row"), true);
  assert.equal(roomNavAtTop("tabs"), true);
  assert.equal(roomNavAtTop("dock"), false);
  assert.equal(roomNavAtTop("rail"), false);
});
