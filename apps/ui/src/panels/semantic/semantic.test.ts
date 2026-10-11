import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedPanelCapability } from "../../api";
import { classifyCapabilityPresentation } from "./classify";
import { composeSemanticPanel, itemsForResponsiveState } from "./compose";

function cap(
  overrides: Partial<ResolvedPanelCapability> & Pick<ResolvedPanelCapability, "id" | "kind" | "name">
): ResolvedPanelCapability {
  return {
    deviceId: "d1",
    deviceName: "Device",
    areaId: "a1",
    areaName: "Area",
    unit: "",
    sourceType: "mqtt",
    hasCommand: false,
    state: { value: 0, quality: "good", updatedAt: new Date().toISOString() },
    ...overrides,
  } as ResolvedPanelCapability;
}

test("classify uses presentation semantics not device identity", () => {
  const reading = classifyCapabilityPresentation(
    cap({ id: "1", kind: "number", name: "Any Metric", unit: "ppm" })
  );
  assert.equal(reading, "reading");

  const control = classifyCapabilityPresentation(
    cap({ id: "2", kind: "switch", name: "Relay", hasCommand: true, state: { value: false, quality: "good", updatedAt: "" } })
  );
  assert.equal(control, "control");
});

test("summary degradation limits items generically", () => {
  const items = [
    { id: "a", label: "A", presentationClass: "reading" as const, value: "1", unit: "", quality: "good", controllable: false, priority: 1, source: cap({ id: "a", kind: "number", name: "A" }) },
    { id: "b", label: "B", presentationClass: "reading" as const, value: "2", unit: "", quality: "good", controllable: false, priority: 1, source: cap({ id: "b", kind: "number", name: "B" }) },
    { id: "c", label: "C", presentationClass: "reading" as const, value: "3", unit: "", quality: "good", controllable: false, priority: 1, source: cap({ id: "c", kind: "number", name: "C" }) },
    { id: "d", label: "D", presentationClass: "reading" as const, value: "4", unit: "", quality: "good", controllable: false, priority: 1, source: cap({ id: "d", kind: "number", name: "D" }) },
  ];
  assert.equal(itemsForResponsiveState(items, "summary").length, 3);
  assert.equal(itemsForResponsiveState(items, "insufficient").length, 0);
});

test("compose readings mode is capability-agnostic", () => {
  const composition = composeSemanticPanel(
    [
      cap({ id: "x", kind: "number", name: "Metric A", unit: "V", state: { value: 3.2, quality: "good", updatedAt: "" } }),
      cap({ id: "y", kind: "text", name: "Metric B", state: { value: "ok", quality: "good", updatedAt: "" } }),
    ],
    "readings"
  );
  assert.equal(composition.mode, "readings");
  assert.equal(composition.items.length, 2);
});
