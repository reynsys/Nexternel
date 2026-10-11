import assert from "node:assert/strict";
import test from "node:test";
import {
  hydrateDashboardPanels,
  serializeDashboardDocumentV3,
} from "./persistence";

test("v3 serialize writes panels and preserves unknown types", () => {
  const doc = serializeDashboardDocumentV3({
    name: "Test",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [
          {
            id: "p1",
            type: "some.future.panel",
            layout: { i: "p1", x: 0, y: 0, w: 4, h: 3 },
            bindings: {},
            config: { custom: true },
          },
        ],
      },
    ],
  });
  assert.equal(doc.schemaVersion, 3);
  assert.equal(doc.sections[0].panels?.[0]?.type, "some.future.panel");
  assert.deepEqual(doc.sections[0].panels?.[0]?.config?.custom, true);
  assert.equal("widgets" in doc.sections[0], false);
});

test("v3 serialize strips legacy placement mins from persisted layout", () => {
  const doc = serializeDashboardDocumentV3({
    name: "Test",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [
          {
            id: "c1",
            type: "panel.charts",
            layout: {
              i: "c1",
              x: 0,
              y: 0,
              w: 8,
              h: 5,
              minW: 6,
              minH: 4,
            },
            bindings: {},
            config: {},
          },
        ],
      },
    ],
  });
  const layout = doc.sections[0].panels?.[0]?.layout;
  assert.deepEqual(layout, { i: "c1", x: 0, y: 0, w: 8, h: 5 });
});

test("hydrate maps legacy widgets to runtime panels", () => {
  const hydrated = hydrateDashboardPanels({
    schemaVersion: 3,
    name: "Test",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [],
        widgets: [
          {
            id: "p1",
            type: "panel.status",
            layout: { i: "p1", x: 0, y: 0, w: 4, h: 3 },
            bindings: {},
            config: {},
          },
        ],
      },
    ],
  });
  assert.equal(hydrated.sections[0].panels.length, 1);
  assert.equal(hydrated.sections[0].panels[0].type, "panel.status");
});

test("hydrate decodes legacy panelScope into runtime config.scope", () => {
  const hydrated = hydrateDashboardPanels({
    schemaVersion: 3,
    name: "Test",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [
          {
            id: "p1",
            type: "panel.status",
            layout: { i: "p1", x: 0, y: 0, w: 4, h: 3 },
            bindings: {},
            config: { panelScope: { systemIds: ["sys-1"] } },
          },
        ],
      },
    ],
  });
  const runtime = hydrated.sections[0].panels[0];
  assert.deepEqual(runtime.config.scope.systemIds, ["sys-1"]);
  assert.equal("panelScope" in (runtime.config as unknown as Record<string, unknown>), false);
});

test("view.garden decodes to panel.controls through migratePanelType at hydrate", () => {
  const runtime = hydrateDashboardPanels({
    schemaVersion: 3,
    name: "G",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [
          {
            id: "g1",
            type: "view.garden",
            layout: { i: "g1", x: 0, y: 0, w: 4, h: 3 },
            bindings: {},
            config: {},
          },
        ],
      },
    ],
  });
  assert.equal(runtime.sections[0].panels[0].type, "panel.controls");
});
