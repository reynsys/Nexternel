import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_CONTRIBUTION_PANEL_TYPES,
  PANEL_GAUGE_TYPE,
  isContributionPanelType,
  isPluginPanelType,
  migrateContributionPanelType,
} from "./contribution-panels.js";

test("migrateContributionPanelType maps legacy plugin gauge", () => {
  assert.equal(migrateContributionPanelType("plugin.gauge"), PANEL_GAUGE_TYPE);
  assert.equal(migrateContributionPanelType("plugin.clock"), "panel.clock");
  assert.equal(migrateContributionPanelType("panel.gauge"), PANEL_GAUGE_TYPE);
});

test("isPluginPanelType is true for plugin.* types only", () => {
  assert.equal(isPluginPanelType("plugin.air-quality"), true);
  assert.equal(isPluginPanelType("plugin.clock"), false);
  assert.equal(isPluginPanelType("plugin.gauge"), false);
  assert.equal(isPluginPanelType(PANEL_GAUGE_TYPE), false);
});

test("isContributionPanelType includes gauge and plugin panels", () => {
  assert.equal(isContributionPanelType(PANEL_GAUGE_TYPE), true);
  assert.equal(isContributionPanelType("plugin.clock"), false);
  assert.equal(isContributionPanelType("panel.clock"), false);
  assert.equal(isContributionPanelType("panel.charts"), false);
});

test("legacy types in migration map", () => {
  assert.deepEqual(LEGACY_CONTRIBUTION_PANEL_TYPES, {
    "plugin.gauge": PANEL_GAUGE_TYPE,
    "plugin.clock": "panel.clock",
  });
});
