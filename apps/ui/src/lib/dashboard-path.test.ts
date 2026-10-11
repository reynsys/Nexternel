import assert from "node:assert/strict";
import test from "node:test";
import { dashboardIdForSlug, dashboardPaths, dashboardSlug } from "./dashboard-path.ts";

const list = [
  { id: "a", name: "DAMN HomE", isDefault: true },
  { id: "b", name: "Kids Bedroom" },
  { id: "c", name: "Café & Garden" },
  { id: "d", name: "Kids  Bedroom!" },
];

test("names become short readable addresses", () => {
  assert.equal(dashboardSlug("Kids Bedroom"), "kids-bedroom");
  assert.equal(dashboardSlug("Café & Garden"), "cafe-garden");
  assert.equal(dashboardSlug("!!!"), "dashboard");
});

test("default is /, others /d/<name>, repeats get -2", () => {
  const paths = dashboardPaths(list);
  assert.equal(paths.get("a"), "/");
  assert.equal(paths.get("b"), "/d/kids-bedroom");
  assert.equal(paths.get("c"), "/d/cafe-garden");
  assert.equal(paths.get("d"), "/d/kids-bedroom-2");
});

test("addresses resolve back to the dashboard", () => {
  assert.equal(dashboardIdForSlug(list, "kids-bedroom"), "b");
  assert.equal(dashboardIdForSlug(list, "kids-bedroom-2"), "d");
  assert.equal(dashboardIdForSlug(list, "damn-home"), "a");
  assert.equal(dashboardIdForSlug(list, "nothing"), null);
  assert.equal(dashboardIdForSlug([], "kids-bedroom"), null);
});
