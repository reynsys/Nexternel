import assert from "node:assert/strict";
import test from "node:test";
import {
  migrateContributionPanelType,
  PANEL_GAUGE_TYPE,
} from "./contribution-panels.js";

test("dashboard panel type migration preserves plugin types except mapped legacy", () => {
  assert.equal(migrateContributionPanelType("plugin.clock"), "panel.clock");
  assert.equal(migrateContributionPanelType("plugin.air-quality"), "plugin.air-quality");
});

test("dashboard panel type migration upgrades legacy gauge", () => {
  assert.equal(migrateContributionPanelType("plugin.gauge"), PANEL_GAUGE_TYPE);
  assert.equal(migrateContributionPanelType(PANEL_GAUGE_TYPE), PANEL_GAUGE_TYPE);
});
