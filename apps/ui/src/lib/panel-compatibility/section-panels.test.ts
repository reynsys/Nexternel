import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardSection } from "../../api";
import {
  normalizeSectionPanelsOnLoad,
  sectionPanels,
  sectionWithPanels,
} from "./section-panels";

const baseSection: DashboardSection = {
  id: "s1",
  title: "Main",
  order: 0,
  panels: [],
};

test("sectionPanels prefers panels over legacy widgets", () => {
  const section = {
    ...baseSection,
    widgets: [
      {
        id: "w1",
        type: "legacy",
        layout: { i: "w1", x: 0, y: 0, w: 4, h: 3 },
        bindings: {},
        config: {},
      },
    ],
    panels: [
      {
        id: "p1",
        type: "panel.status",
        layout: { i: "p1", x: 0, y: 0, w: 4, h: 3 },
        bindings: {},
        config: {},
      },
    ],
  };
  assert.equal(sectionPanels(section)[0]?.id, "p1");
});

test("sectionWithPanels writes panels only", () => {
  const panel = {
    id: "p1",
    type: "panel.status",
    layout: { i: "p1", x: 0, y: 0, w: 4, h: 3 },
    bindings: {},
    config: {},
  };
  const next = sectionWithPanels(baseSection, [panel]);
  assert.equal(next.panels?.[0]?.id, "p1");
  assert.equal((next as Record<string, unknown>).widgets, undefined);
});

test("normalizeSectionPanelsOnLoad reads legacy widgets into panels", () => {
  const section = {
    ...baseSection,
    widgets: [
      {
        id: "w1",
        type: "panel.controls",
        layout: { i: "w1", x: 0, y: 0, w: 4, h: 3 },
        bindings: {},
        config: {},
      },
    ],
  };
  const normalized = normalizeSectionPanelsOnLoad(section);
  assert.equal(normalized.panels[0]?.type, "panel.controls");
  assert.equal((normalized as Record<string, unknown>).widgets, undefined);
});
