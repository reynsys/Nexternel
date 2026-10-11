import assert from "node:assert/strict";
import test from "node:test";
import { normalizePanelBindings } from "@nexternel/domain";
import { decodePanelInstance } from "./normalize-panel.ts";
import { serializePanelInstance } from "./serialize-panel.ts";

const layout = { i: "w1", x: 0, y: 0, w: 4, h: 3 };

test("decode normalizes legacy deviceId into runtime bindings", () => {
  const runtime = decodePanelInstance({
    id: "p1",
    type: "panel.status",
    layout,
    bindings: { deviceId: "dev-legacy", capabilityId: "cap-1" },
    config: { panelScope: { systemIds: [] } },
  });
  assert.deepEqual(runtime.bindings.deviceIds, ["dev-legacy"]);
  assert.equal("deviceId" in runtime.bindings, false);
  assert.equal(runtime.bindings.capabilityId, "cap-1");
});

test("serialize emits canonical bindings", () => {
  const runtime = decodePanelInstance({
    id: "p1",
    type: "echarts",
    layout,
    bindings: { deviceId: "dev-1", timezone: "UTC" },
    config: { panelScope: { systemIds: [] }, presetId: "gauge" },
  });
  const serialized = serializePanelInstance(runtime, layout);
  assert.deepEqual(serialized.bindings.deviceIds, ["dev-1"]);
  assert.equal(serialized.bindings.timezone, "UTC");
  assert.equal("deviceId" in serialized.bindings, false);
});

test("canonical bindings are stable across decode", () => {
  const first = decodePanelInstance({
    id: "p1",
    type: "panel.gauge",
    layout,
    bindings: {
      capabilityId: "cap-1",
      capabilityIds: ["cap-1"],
      slots: { primary: "cap-1" },
    },
    config: { panelScope: { systemIds: [] } },
  });
  const second = decodePanelInstance({
    id: "p1",
    type: "panel.gauge",
    layout,
    bindings: first.bindings,
    config: { panelScope: { systemIds: [] } },
  });
  assert.deepEqual(first.bindings, second.bindings);
  assert.deepEqual(normalizePanelBindings(first.bindings), first.bindings);
});
