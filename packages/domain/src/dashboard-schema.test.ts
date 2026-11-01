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

type Migrated = { gridCols: number; sections: Array<{ panels: Array<{ id: string; layout: { x: number; y: number; w: number; h: number } }> }> };
const lp = (i: string, x: number, y: number, w: number, h: number) => ({ id: i, type: "panel.status", layout: { i, x, y, w, h } });
const placesOf = (doc: Migrated) => Object.fromEntries(doc.sections[0]!.panels.map((q) => [q.id, [q.layout.x, q.layout.y, q.layout.w, q.layout.h]]));

test("every dashboard is 5 across: a 12-column one moves to 10 once, in order, then into steps (×6)", () => {
  const old = { schemaVersion: 3, name: "T", sections: [{ id: "s", title: "S", order: 0, panels: [lp("a", 0, 0, 2, 2), lp("b", 2, 0, 2, 2), lp("c", 4, 0, 2, 2), lp("d", 6, 0, 2, 2), lp("e", 8, 0, 2, 2), lp("f", 10, 0, 2, 2), lp("w", 0, 2, 12, 2)] }] };
  const moved = migrateDashboardDocument(old) as unknown as Migrated;
  assert.equal(moved.gridCols, 60);
  const at = placesOf(moved);
  assert.deepEqual(at.e, [48, 0, 12, 2]);
  assert.deepEqual(at.f, [0, 2, 12, 2]);
  assert.deepEqual(at.w, [0, 4, 60, 2]);
  const again = migrateDashboardDocument(moved) as unknown as Migrated;
  assert.deepEqual(again.sections, moved.sections); // only once
  assert.equal(again.gridCols, 60);
  assert.equal((migrateDashboardDocument({ ...old, gridCols: 8 }) as { gridCols?: number }).gridCols, 48);
});

test("a 10-column dashboard keeps every panel's size and place exactly: widths and places ×6, heights kept", () => {
  // The live Energy dashboard on 01/11/2026.
  const energy = { schemaVersion: 3, name: "Energy", gridCols: 10, sections: [{ id: "s", title: "Main", order: 0, panels: [lp("g1", 0, 0, 3, 3), lp("g2", 3, 0, 3, 3), lp("g3", 6, 0, 3, 3), lp("c1", 0, 3, 3, 3), lp("c2", 3, 3, 4, 3), lp("c3", 0, 6, 4, 3)] }] };
  const moved = migrateDashboardDocument(energy) as unknown as Migrated;
  assert.equal(moved.gridCols, 60);
  assert.deepEqual(placesOf(moved), {
    g1: [0, 0, 18, 3], g2: [18, 0, 18, 3], g3: [36, 0, 18, 3],
    c1: [0, 3, 18, 3], c2: [18, 3, 24, 3], c3: [0, 6, 24, 3],
  });
  const fourAcross = migrateDashboardDocument({ ...energy, gridCols: 8 }) as unknown as Migrated;
  assert.equal(fourAcross.gridCols, 48);
  assert.deepEqual(placesOf(fourAcross).c2, [18, 3, 24, 3]);
});

test("older documents without panels across (v1 widgets, v2 sections) move to 60 steps too", () => {
  const v1 = migrateDashboardDocument({ name: "Old", widgets: [lp("a", 10, 0, 2, 2)] }) as unknown as Migrated;
  assert.equal(v1.gridCols, 60);
  assert.deepEqual(placesOf(v1).a, [0, 0, 12, 2]); // packed onto 10 squares first, then ×6
  const v2 = migrateDashboardDocument({ schemaVersion: 2, name: "Old", sections: [{ id: "s", title: "S", order: 0, widgets: [lp("a", 0, 0, 4, 2)] }] }) as unknown as Migrated;
  assert.equal(v2.gridCols, 60);
  assert.deepEqual(placesOf(v2).a, [0, 0, 24, 2]);
});
