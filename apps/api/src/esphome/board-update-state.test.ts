import assert from "node:assert/strict";
import test from "node:test";
import { boardUpdateState } from "./board-updates.js";

const board = (over: Record<string, unknown> = {}) => ({ configuration: "kids-room.yaml", expected_config_hash: "913f5c2a", ...over });

test("a board needs an update only when the software it reports differs from the newest build", () => {
  assert.equal(boardUpdateState(board(), "913f5c2a"), "current");
  assert.equal(boardUpdateState(board(), "5842d032"), "update");
});

test("without the board's own fingerprint (or a build) it is not known", () => {
  assert.equal(boardUpdateState(board(), null), "unknown");
  assert.equal(boardUpdateState(board({ expected_config_hash: "" }), "913f5c2a"), "unknown");
  assert.equal(boardUpdateState(undefined, "913f5c2a"), "unknown");
});

test("a newer ESPHome than the board runs is always an update", () => {
  assert.equal(boardUpdateState(board({ update_available: true }), null), "update");
});
