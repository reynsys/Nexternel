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

test("a section's hidden bar (showTitle: false) is kept when saved and loaded", () => {
  const doc = {
    schemaVersion: 3,
    name: "Test",
    sections: [{ id: "s1", title: "Main", order: 0, panels: [], showTitle: false }, { id: "s2", title: "Two", order: 1, panels: [] }],
  };
  const parsed = DashboardDocumentV3Schema.parse(doc);
  assert.equal(parsed.sections[0]?.showTitle, false);
  const migrated = migrateDashboardDocument(doc) as { sections: Array<{ showTitle?: boolean }> };
  assert.equal(migrated.sections[0]?.showTitle, false);
  assert.equal(migrated.sections[1]?.showTitle, undefined);
});

test("every dashboard is 5 across: a 12-column one moves to 10 once, in order; 10 and 8 are kept", () => {
  const p = (i: string, x: number, y: number, w: number, h: number) => ({ id: i, type: "panel.status", layout: { i, x, y, w, h } });
  const old = { schemaVersion: 3, name: "T", sections: [{ id: "s", title: "S", order: 0, panels: [p("a", 0, 0, 2, 2), p("b", 2, 0, 2, 2), p("c", 4, 0, 2, 2), p("d", 6, 0, 2, 2), p("e", 8, 0, 2, 2), p("f", 10, 0, 2, 2), p("w", 0, 2, 12, 2)] }] };
  const moved = migrateDashboardDocument(old) as unknown as { gridCols: number; sections: Array<{ panels: Array<{ id: string; layout: { x: number; y: number; w: number } }> }> };
  assert.equal(moved.gridCols, 10);
  const at = Object.fromEntries(moved.sections[0]!.panels.map((q) => [q.id, [q.layout.x, q.layout.y, q.layout.w]]));
  assert.deepEqual(at.e, [8, 0, 2]);
  assert.deepEqual(at.f, [0, 2, 2]);
  assert.deepEqual(at.w, [0, 4, 10]);
  const again = migrateDashboardDocument(moved) as unknown as { gridCols: number; sections: Array<{ panels: Array<{ id: string; layout: { x: number } }> }> };
  assert.deepEqual(again.sections, moved.sections); // only once
  assert.equal((migrateDashboardDocument({ ...old, gridCols: 8 }) as { gridCols?: number }).gridCols, 8);
});
