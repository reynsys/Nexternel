import assert from "node:assert/strict";
import test from "node:test";
import { itemsForResponsiveState } from "../semantic/compose";
import type { SemanticCapabilityView } from "../semantic/types";

function item(id: string, priority = 1): SemanticCapabilityView {
  return {
    id,
    label: id,
    presentationClass: "reading",
    value: "1",
    unit: "x",
    quality: "good",
    controllable: false,
    priority,
    source: {
      id,
      deviceId: "d1",
      deviceName: "Device",
      kind: "sensor",
      name: id,
      unit: "x",
      sourceType: "sensor",
      hasCommand: false,
      systemId: null,
      areaId: null,
      groupId: null,
      areaName: null,
      state: null,
    },
  };
}

test("semantic degradation limits summary items generically", () => {
  const items = [item("a", 3), item("b", 2), item("c", 1), item("d", 0)];
  assert.equal(itemsForResponsiveState(items, "comfortable").length, 4);
  assert.equal(itemsForResponsiveState(items, "compact").length, 4);
  assert.equal(itemsForResponsiveState(items, "summary").length, 3);
  assert.equal(itemsForResponsiveState(items, "insufficient").length, 0);
});
