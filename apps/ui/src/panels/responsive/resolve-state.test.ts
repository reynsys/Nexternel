import assert from "node:assert/strict";
import test from "node:test";
import { clampResponsiveState, resolvePanelResponsiveState } from "./resolve-state";

const sizing = {
  minWidth: 2,
  minHeight: 2,
  degradationModes: ["comfortable", "compact", "summary", "insufficient"] as const,
};

test("resolve responsive state uses platform thresholds", () => {
  assert.equal(resolvePanelResponsiveState({ width: 400, height: 300 }, sizing), "comfortable");
  assert.equal(resolvePanelResponsiveState({ width: 140, height: 120 }, sizing), "compact");
  assert.equal(resolvePanelResponsiveState({ width: 80, height: 80 }, sizing), "summary");
  assert.equal(resolvePanelResponsiveState({ width: 40, height: 40 }, sizing), "summary");
  assert.equal(resolvePanelResponsiveState({ width: 39, height: 39 }, sizing), "insufficient");
});

test("clamp respects panel sizing degradation contract", () => {
  const restricted = {
    ...sizing,
    degradationModes: ["comfortable", "compact"] as const,
  };
  assert.equal(resolvePanelResponsiveState({ width: 80, height: 80 }, restricted), "compact");
  assert.equal(clampResponsiveState("summary", ["comfortable", "compact"]), "compact");
});
