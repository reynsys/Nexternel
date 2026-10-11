import assert from "node:assert/strict";
import test from "node:test";
import { PANEL_GAUGE_TYPE } from "@nexternel/domain";
import type { WidgetInstance } from "../../api";
import { effectivePanelScope } from "../panel-scope";
import { normalizeDashboardDocument } from "./document.ts";
import { normalizePanelInstance } from "./normalize-panel.ts";
import { serializePanelInstance } from "./serialize-panel.ts";

const baseLayout = { x: 0, y: 0, w: 4, h: 3, i: "w1" };

function widget(
  overrides: Partial<WidgetInstance> & Pick<WidgetInstance, "id" | "type">
): WidgetInstance {
  return {
    layout: baseLayout,
    bindings: {},
    config: {},
    ...overrides,
  };
}

test("current core panel normalizes without type migration", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "core-1",
      type: "panel.controls",
      config: {
        panelScope: {
          inheritSectionArea: false,
          systemIds: ["sys-a"],
        },
      },
    })
  );
  assert.equal(panel.type, "panel.controls");
  assert.equal(panel.compatibility.availability, "known");
  assert.deepEqual(panel.config.scope.systemIds, ["sys-a"]);
});

test("legacy widget type maps to current panel type", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "legacy-1",
      type: "plugin.gauge",
    })
  );
  assert.equal(panel.type, PANEL_GAUGE_TYPE);
  assert.equal(panel.compatibility.sourceType, "plugin.gauge");
  assert.equal(panel.compatibility.typeMigrated, true);
});

test("legacy viewScope normalizes to equivalent panel scope", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "scope-1",
      type: "panel.status",
      config: {
        viewScope: {
          inheritSectionArea: true,
          areaIds: ["area-1"],
          systemIds: ["sys-1"],
          groupIds: ["grp-1"],
          contentMode: "manual",
          capabilityIds: ["cap-1"],
        },
      },
    })
  );
  assert.equal(panel.compatibility.legacyScopeSource, "viewScope");
  assert.deepEqual(panel.config.scope, {
    inheritSectionArea: true,
    areaIds: ["area-1"],
    systemIds: ["sys-1"],
    groupIds: ["grp-1"],
    contentMode: "manual",
    capabilityIds: ["cap-1"],
    cameraIds: [],
  });
});

test("section area inheritance remains semantically identical", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "inherit-1",
      type: "panel.charts",
      config: {
        panelScope: { inheritSectionArea: true, areaIds: [] },
      },
    })
  );
  const effective = effectivePanelScope(panel.config.scope, "section-area");
  assert.deepEqual(effective.areaIds, ["section-area"]);
});

test("manual capability bindings survive normalization unchanged", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "manual-1",
      type: "panel.camera",
      config: {
        panelScope: {
          contentMode: "manual",
          capabilityIds: ["cap-a", "cap-b"],
          cameraIds: ["cam-1"],
        },
      },
    })
  );
  assert.deepEqual(panel.config.scope.capabilityIds, ["cap-a", "cap-b"]);
  assert.deepEqual(panel.config.scope.cameraIds, ["cam-1"]);
});

test("unknown panel type is preserved losslessly", () => {
  const original = widget({
    id: "future-1",
    type: "some.future.panel",
    title: "Future",
    config: {
      customField: { nested: true },
      panelScope: { systemIds: ["sys-z"] },
    },
  });
  const panel = normalizePanelInstance(original);
  assert.equal(panel.type, "some.future.panel");
  assert.equal(panel.compatibility.availability, "unknown");
  assert.equal(panel.compatibility.sourceType, "some.future.panel");
  const roundTrip = serializePanelInstance(panel, original.layout);
  assert.equal(roundTrip.type, "some.future.panel");
  assert.deepEqual(roundTrip.config.customField, { nested: true });
  const savedScope = roundTrip.config.panelScope as { systemIds?: string[] } | undefined;
  assert.deepEqual(savedScope?.systemIds, ["sys-z"]);
});

test("unknown configuration fields are preserved where safe", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "cfg-1",
      type: "panel.legacy-air-quality",
      config: {
        unknownFutureKey: "keep-me",
        panelScope: { systemIds: [] },
      },
    })
  );
  assert.equal(panel.config.data.unknownFutureKey, "keep-me");
  const roundTrip = serializePanelInstance(panel, baseLayout);
  assert.equal(roundTrip.config.unknownFutureKey, "keep-me");
});

test("older configuration schema migrates gaugeStyle to presetId", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "gauge-1",
      type: "echarts",
      config: {
        gaugeStyle: "thermometer",
        panelScope: { systemIds: [] },
      },
    })
  );
  assert.equal(panel.config.data.presetId, "gauge-temperature");
});

test("normalized dashboard sections round-trip through current persistence format", () => {
  const doc = normalizeDashboardDocument({
    schemaVersion: 2,
    name: "Test",
    sections: [
      {
        id: "sec-1",
        title: "Main",
        order: 0,
        widgets: [
          widget({
            id: "w-save",
            type: "view.lighting",
            config: {
              viewScope: { inheritSectionArea: true, systemIds: ["lights"] },
            },
          }),
        ],
      },
    ],
  });
  const saved = doc.sections[0].panels[0];
  const panel = normalizePanelInstance(saved);
  const serialized = serializePanelInstance(panel, saved.layout);
  assert.equal(serialized.id, "w-save");
  assert.ok(serialized.config.viewScope || serialized.config.panelScope);
});

test("plugin panel configuration survives normalization", () => {
  const panel = normalizePanelInstance(
    widget({
      id: "plugin-1",
      type: "plugin.clock",
      bindings: { timezone: "Europe/London" },
      config: {
        panelScope: { systemIds: [] },
        faceStyle: "analog",
      },
    })
  );
  assert.equal(panel.type, "panel.clock");
  assert.equal(panel.compatibility.sourceType, "plugin.clock");
  assert.equal(panel.bindings.timezone, "Europe/London");
  assert.equal(panel.config.data.faceStyle, "analog");
});

