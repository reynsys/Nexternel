import assert from "node:assert/strict";
import test from "node:test";
import { areaLineFromAreas, readPanelAreaLine, withPanelAreaLine } from "./panel-area-line.js";

test("automatic area line: one, a few, many, none", () => {
  assert.equal(areaLineFromAreas(["Living Room", "living room "]), "Living Room");
  assert.equal(areaLineFromAreas(["Living Room", "Kids Bedroom", null]), "Living Room · Kids Bedroom");
  assert.equal(areaLineFromAreas(["A", "B", "C", "D"]), "4 areas");
  assert.equal(areaLineFromAreas([null, " "]), null);
});

test("area line choice is read and written back", () => {
  assert.deepEqual(readPanelAreaLine({}), { mode: "auto" });
  assert.deepEqual(readPanelAreaLine({ areaLine: { mode: "none" } }), { mode: "none" });
  assert.deepEqual(readPanelAreaLine({ areaLine: { mode: "area", areaId: "x", name: "Upstairs" } }), { mode: "area", areaId: "x", name: "Upstairs" });
  assert.deepEqual(readPanelAreaLine({ areaLine: { mode: "area" } }), { mode: "auto" });
  assert.deepEqual(withPanelAreaLine({ areaLine: { mode: "none" }, a: 1 }, { mode: "auto" }), { a: 1 });
});
