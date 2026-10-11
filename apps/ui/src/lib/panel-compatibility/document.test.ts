import assert from "node:assert/strict";
import test from "node:test";
import type { WidgetInstance } from "../../api";
import {
  migratePersistedDashboardDocument,
  normalizeDashboardDocument,
} from "./document.ts";
import { isRuntimePanelInstance } from "./normalize-panel.ts";
import { serializeDashboardDocumentV3 } from "./persistence.ts";

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

function panelSnapshot(doc: ReturnType<typeof normalizeDashboardDocument>) {
  return doc.sections.map((section) =>
    section.panels.map((panel) => ({
      id: panel.id,
      type: panel.type,
      scope: panel.config.scope,
      hasRuntimeShape: isRuntimePanelInstance(panel),
    }))
  );
}

test("ingress: legacy v2 widgets become runtime panels with config.scope", () => {
  const runtime = normalizeDashboardDocument({
    schemaVersion: 2,
    name: "Legacy",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        widgets: [
          widget({
            id: "w1",
            type: "view.lighting",
            config: {
              viewScope: { inheritSectionArea: true, systemIds: ["lights"] },
            },
          }),
        ],
      },
    ],
  });
  const panel = runtime.sections[0].panels[0];
  assert.equal(panel.type, "panel.controls");
  assert.ok(isRuntimePanelInstance(panel));
  assert.deepEqual(panel.config.scope.systemIds, ["lights"]);
  assert.equal("viewScope" in (panel.config as unknown as Record<string, unknown>), false);
});

test("ingress: canonical v3 document is idempotent through normalizeDashboardDocument", () => {
  const first = normalizeDashboardDocument({
    schemaVersion: 3,
    name: "Canonical",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [
          widget({
            id: "p1",
            type: "panel.status",
            config: { panelScope: { systemIds: ["env"] } },
          }),
        ],
      },
    ],
  });
  const persisted = serializeDashboardDocumentV3(first);
  const second = normalizeDashboardDocument(persisted, "Canonical");
  assert.deepEqual(panelSnapshot(first), panelSnapshot(second));
});

test("migratePersistedDashboardDocument does not decode to runtime scope shape", () => {
  const persisted = migratePersistedDashboardDocument({
    schemaVersion: 3,
    name: "P",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [
          widget({
            id: "p1",
            type: "panel.status",
            config: { panelScope: { systemIds: ["a"] } },
          }),
        ],
      },
    ],
  });
  const raw = persisted.sections[0].panels[0].config as Record<string, unknown>;
  assert.ok(raw.panelScope || raw.viewScope);
  assert.equal(isRuntimePanelInstance(persisted.sections[0].panels[0]), false);
});
