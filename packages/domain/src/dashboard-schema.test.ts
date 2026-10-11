import assert from "node:assert/strict";
import test from "node:test";
import {
  DashboardDocumentV3Schema,
  migrateDashboardDocument,
} from "./dashboard.js";

test("v3 canonical section schema requires panels and excludes widgets", () => {
  const parsed = DashboardDocumentV3Schema.safeParse({
    schemaVersion: 3,
    name: "Test",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [],
      },
    ],
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal("widgets" in parsed.data.sections[0], false);
  }
});

test("migrateDashboardDocument upgrades v2 widgets to v3 panels", () => {
  const migrated = migrateDashboardDocument({
    schemaVersion: 2,
    name: "Legacy",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        widgets: [
          {
            id: "w1",
            type: "panel.status",
            layout: { i: "w1", x: 0, y: 0, w: 4, h: 3 },
            bindings: {},
            config: {},
          },
        ],
      },
    ],
  });
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.sections[0].panels[0]?.id, "w1");
  assert.equal("widgets" in migrated.sections[0], false);
});

test("migrateDashboardDocument coerces legacy widget records with partial layout", () => {
  const migrated = migrateDashboardDocument({
    schemaVersion: 3,
    name: "Legacy layout",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [],
        widgets: [
          {
            id: "w1",
            type: "panel.controls",
            layout: { x: 0, y: 0, w: 4, h: 3 },
          },
        ],
      },
    ],
  });
  assert.equal(migrated.sections[0].panels[0]?.id, "w1");
  assert.equal(migrated.sections[0].panels[0]?.layout.i, "w1");
});

test("migrateDashboardDocument reads v3 sections with legacy widgets field", () => {
  const migrated = migrateDashboardDocument({
    schemaVersion: 3,
    name: "Mixed",
    sections: [
      {
        id: "s1",
        title: "Main",
        order: 0,
        panels: [],
        widgets: [
          {
            id: "w1",
            type: "panel.controls",
            layout: { i: "w1", x: 0, y: 0, w: 4, h: 3 },
            bindings: {},
            config: {},
          },
        ],
      },
    ],
  });
  assert.equal(migrated.sections[0].panels[0]?.type, "panel.controls");
  assert.equal("widgets" in migrated.sections[0], false);
});
