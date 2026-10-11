import { test } from "node:test";
import assert from "node:assert/strict";
import { collectOldTopicRoots } from "./topic-roots.js";

test("collectOldTopicRoots derives from operational and domain prefixes", () => {
  const roots = collectOldTopicRoots("damnhome", ["damnhome/garden", "nexternel/foo"]);
  assert.ok(roots.includes("damnhome"));
  assert.ok(roots.includes("nexternel"));
  assert.equal(roots.includes("garden"), false);
});
