import assert from "node:assert/strict";
import test from "node:test";
import { normalizePanelKind as domainNormalizePanelKind } from "@nexternel/domain";
import { normalizePanelKind } from "./panel-kind.ts";
import { migratePanelType } from "./panel-compatibility/panel-type.ts";
import { panelHeading } from "./panel-heading.ts";
import { decodePanelInstance } from "./panel-compatibility/normalize-panel.ts";
import type { PanelInstance } from "../api.ts";

test("UI panel-kind delegates to domain", () => {
  assert.equal(normalizePanelKind, domainNormalizePanelKind);
  assert.equal(normalizePanelKind("view.garden"), "panel.controls");
});

test("decode and heading agree on canonical kind for view.garden", () => {
  const placed: PanelInstance = {
    id: "g1",
    type: "view.garden",
    layout: { i: "g1", x: 0, y: 0, w: 4, h: 3 },
    bindings: {},
    config: { panelScope: { contentMode: "auto" } },
  };
  const runtime = decodePanelInstance(placed);
  assert.equal(runtime.type, "panel.controls");
  assert.equal(normalizePanelKind(runtime.type), normalizePanelKind(placed.type));
});

test("decode and heading agree on view.charts", () => {
  const placed: PanelInstance = {
    id: "c1",
    type: "view.charts",
    layout: { i: "c1", x: 0, y: 0, w: 4, h: 3 },
    bindings: {},
    config: {},
  };
  const runtime = decodePanelInstance(placed);
  assert.equal(runtime.type, "panel.charts");
  const heading = panelHeading(runtime, []);
  assert.equal(heading.title, "Charts");
});

test("migratePanelType uses domain kind for view.garden", () => {
  const migrated = migratePanelType("view.garden");
  assert.equal(migrated.type, "panel.controls");
  assert.equal(migrated.sourceType, "view.garden");
});
