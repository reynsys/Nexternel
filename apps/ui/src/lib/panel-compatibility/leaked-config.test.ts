import assert from "node:assert/strict";
import test from "node:test";
import { decodePanelInstance } from "./normalize-panel.ts";
import { runtimeConfigToPanelRecord } from "./panel-config.ts";
import { serializePanelInstance } from "./serialize-panel.ts";

const DRIVEWAY = "f6cf0b22-c387-46c8-be82-7640e26a4ad0";
const DRIVEWAY_AREA = "f5f9858b-4803-4500-862b-40264c0530ee";
const layout = { i: "cams", x: 0, y: 0, w: 12, h: 4 };

/** The live CCTV panel config on 10/10/2026: three saves nested the old config under `data`. */
const nestedCctvConfig = {
  data: {
    data: {
      data: { appearance: { layout: "grid" } },
      scope: { areaIds: [], groupIds: [], cameraIds: [], systemIds: [], contentMode: "auto", capabilityIds: [], inheritSectionArea: false },
      appearance: { layout: "card", direction: "across" },
      schemaVersion: 1,
      preservedFields: {},
    },
    scope: { areaIds: [DRIVEWAY_AREA], groupIds: [], cameraIds: [DRIVEWAY], systemIds: [], contentMode: "manual", capabilityIds: [], inheritSectionArea: false },
    appearance: { layout: "card", direction: "across" },
    schemaVersion: 1,
    preservedFields: {},
  },
  scope: { areaIds: [DRIVEWAY_AREA], groupIds: [], cameraIds: [DRIVEWAY], systemIds: [], contentMode: "manual", capabilityIds: [], inheritSectionArea: false },
  appearance: { layout: "card", direction: "across" },
  panelScope: { areaIds: [DRIVEWAY_AREA], groupIds: [], cameraIds: [DRIVEWAY], systemIds: [], contentMode: "manual", capabilityIds: [], inheritSectionArea: false },
  schemaVersion: 1,
  preservedFields: {},
  configSchemaVersion: 1,
};

test("nested runtime layers are flattened on load; newest values win", () => {
  const panel = decodePanelInstance({ id: "cams", type: "panel.camera", title: "Cameras", layout, bindings: {}, config: nestedCctvConfig });
  assert.deepEqual(panel.config.scope.cameraIds, [DRIVEWAY]);
  assert.equal(panel.config.scope.contentMode, "manual");
  assert.deepEqual(panel.config.data.appearance, { layout: "card", direction: "across" });
  assert.equal("data" in panel.config.data, false);
  assert.equal("scope" in panel.config.data, false);
  assert.equal("preservedFields" in panel.config.data, false);
});

test("saving a repaired panel writes a flat config", () => {
  const panel = decodePanelInstance({ id: "cams", type: "panel.camera", layout, bindings: {}, config: nestedCctvConfig });
  const saved = serializePanelInstance(panel, layout);
  assert.equal("data" in saved.config, false);
  assert.equal("preservedFields" in saved.config, false);
  assert.deepEqual((saved.config.panelScope as { cameraIds: string[] }).cameraIds, [DRIVEWAY]);
});

test("an editor working on the saved format does not nest", () => {
  const panel = decodePanelInstance({
    id: "s", type: "panel.status", layout, bindings: {},
    config: { panelScope: { contentMode: "manual", capabilityIds: ["a"] }, appearance: { direction: "down" } },
  });
  // What the editor now receives (saved format) and spreads before adding its changes.
  const edited = { ...runtimeConfigToPanelRecord(panel.config), panelScope: { contentMode: "manual", capabilityIds: ["a", "b"] } };
  const again = decodePanelInstance({ id: "s", type: "panel.status", layout, bindings: {}, config: edited });
  assert.deepEqual(again.config.scope.capabilityIds, ["a", "b"]);
  assert.deepEqual(again.config.data.appearance, { direction: "down" });
  assert.equal("data" in again.config.data, false);
});

test("a stale `scope` beside the saved `panelScope` is dropped; panelScope wins", () => {
  const panel = decodePanelInstance({
    id: "c", type: "panel.camera", layout, bindings: {},
    config: {
      configSchemaVersion: 1,
      scope: { contentMode: "manual", cameraIds: ["old"] },
      panelScope: { contentMode: "manual", cameraIds: [DRIVEWAY] },
    },
  });
  assert.deepEqual(panel.config.scope.cameraIds, [DRIVEWAY]);
  assert.equal("scope" in panel.config.data, false);
  const saved = serializePanelInstance(panel, layout);
  assert.equal("scope" in saved.config, false);
});

test("what an editor receives round-trips through a save unchanged", () => {
  const original = { panelScope: { contentMode: "manual", capabilityIds: ["a", "b"] }, appearance: { direction: "down", itemStyle: "list" }, configSchemaVersion: 1 };
  const panel = decodePanelInstance({ id: "s", type: "panel.status", layout, bindings: {}, config: original });
  const forEditor = serializePanelInstance(panel, layout);
  const afterApply = decodePanelInstance({ ...forEditor, config: { ...forEditor.config } });
  const resaved = serializePanelInstance(afterApply, layout);
  assert.deepEqual(resaved.config, forEditor.config);
  assert.equal("scope" in resaved.config, false);
});
