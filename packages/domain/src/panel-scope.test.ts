import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultPanelContentMode,
  normalizePanelKind,
  resolvePanelContentMode,
  type PanelScope,
} from "./panel-scope.js";
import { migrateContributionPanelType } from "./contribution-panels.js";

describe("resolvePanelContentMode", () => {
  it("uses explicit contentMode when set", () => {
    const scope: PanelScope = {
      areaIds: [],
      systemIds: [],
      groupIds: [],
      contentMode: "auto",
      capabilityIds: ["00000000-0000-4000-8000-000000000001"],
      cameraIds: [],
    };
    assert.equal(resolvePanelContentMode(scope), "auto");
  });

  it("infers manual from non-empty capabilityIds when contentMode omitted", () => {
    const scope: PanelScope = {
      areaIds: [],
      systemIds: [],
      groupIds: [],
      capabilityIds: ["00000000-0000-4000-8000-000000000001"],
      cameraIds: [],
    };
    assert.equal(resolvePanelContentMode(scope), "manual");
  });

  it("infers manual from non-empty cameraIds when contentMode omitted", () => {
    const scope: PanelScope = {
      areaIds: [],
      systemIds: [],
      groupIds: [],
      capabilityIds: [],
      cameraIds: ["00000000-0000-4000-8000-000000000002"],
    };
    assert.equal(resolvePanelContentMode(scope), "manual");
  });

  it("infers auto from empty capabilityIds when contentMode omitted", () => {
    const scope: PanelScope = {
      areaIds: [],
      systemIds: [],
      groupIds: [],
      capabilityIds: [],
      cameraIds: [],
    };
    assert.equal(resolvePanelContentMode(scope), "auto");
  });
});

describe("normalizePanelKind", () => {
  it("maps view.lighting and view.garden to panel.controls", () => {
    assert.equal(normalizePanelKind("view.lighting"), "panel.controls");
    assert.equal(normalizePanelKind("view.garden"), "panel.controls");
  });

  it("maps generic view.* to panel.* by suffix", () => {
    assert.equal(normalizePanelKind("view.charts"), "panel.charts");
    assert.equal(normalizePanelKind("view.status"), "panel.status");
    assert.equal(normalizePanelKind("view.camera"), "panel.camera");
    assert.equal(normalizePanelKind("view.weather"), "panel.weather");
    assert.equal(normalizePanelKind("view.system"), "panel.system");
    assert.equal(normalizePanelKind("view.climate"), "panel.climate");
  });

  it("does not map view.garden to retired panel.garden", () => {
    assert.notEqual(normalizePanelKind("view.garden"), "panel.garden");
  });

  it("leaves canonical panel.* and contribution types unchanged", () => {
    assert.equal(normalizePanelKind("panel.controls"), "panel.controls");
    assert.equal(normalizePanelKind("panel.charts"), "panel.charts");
    assert.equal(normalizePanelKind("plugin.clock"), "plugin.clock");
  });

  it("applies kind after contribution type migration when composed", () => {
    const migrated = migrateContributionPanelType("plugin.gauge");
    assert.equal(normalizePanelKind(migrated), "panel.gauge");
  });

  it("preserves unknown types verbatim", () => {
    assert.equal(normalizePanelKind("some.future.panel"), "some.future.panel");
    assert.equal(normalizePanelKind("stat"), "stat");
  });
});

describe("defaultPanelContentMode", () => {
  it("defaults charts to manual", () => {
    assert.equal(defaultPanelContentMode("panel.charts"), "manual");
  });

  it("defaults status, controls, and camera to manual (Add Panel picks items)", () => {
    assert.equal(defaultPanelContentMode("panel.status"), "manual");
    assert.equal(defaultPanelContentMode("panel.controls"), "manual");
    assert.equal(defaultPanelContentMode("panel.camera"), "manual");
  });

  it("defaults integration panels to auto", () => {
    assert.equal(defaultPanelContentMode("panel.weather"), "auto");
  });
});
