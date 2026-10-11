import assert from "node:assert/strict";
import test from "node:test";
import { isCorePanelCatalogType } from "./add-panel-catalog.js";
import { PANEL_GAUGE_TYPE } from "./contribution-panels.js";

test("isCorePanelCatalogType excludes contribution panels", () => {
  assert.equal(isCorePanelCatalogType("panel.charts"), true);
  assert.equal(isCorePanelCatalogType(PANEL_GAUGE_TYPE), false);
  assert.equal(isCorePanelCatalogType("plugin.gauge"), false);
  assert.equal(isCorePanelCatalogType("plugin.clock"), true);
  assert.equal(isCorePanelCatalogType("panel.clock"), true);
});
