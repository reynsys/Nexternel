import assert from "node:assert/strict";
import test from "node:test";
import { PANEL_GAUGE_TYPE } from "@nexternel/domain";
import type { PanelInstance } from "../../api";
import { decodePanelInstance } from "../../lib/panel-compatibility/normalize-panel";
import { rebootstrapV5PanelRegistry } from "./bootstrap";
import { registerContributionPanel } from "./register";
import { resolvePanelRegistration, resolvePanelRegistrationByType } from "./resolve";
import { clearPanelRegistrations, listPanelRegistrations } from "./store";
import { migratePanelConfiguration } from "./config-migration";

const layout = { x: 0, y: 0, w: 4, h: 3, i: "w1" };

function panelInstance(
  overrides: Partial<PanelInstance> & Pick<PanelInstance, "id" | "type">
) {
  return {
    layout,
    bindings: {},
    config: {},
    ...overrides,
  } satisfies PanelInstance;
}

test.beforeEach(() => {
  clearPanelRegistrations();
  rebootstrapV5PanelRegistry();
});

test("core panels register in the V5 logical registry", () => {
  const resolved = resolvePanelRegistrationByType("panel.controls");
  assert.equal(resolved.availability, "available");
  assert.equal(resolved.implementation?.kind, "core-scoped");
  assert.equal(resolved.descriptor?.label, "Controls");
  assert.ok(resolved.descriptor?.sizing.minWidth);
});

test("contribution panels register through the same registry", () => {
  registerContributionPanel({
    type: PANEL_GAUGE_TYPE,
    label: "Gauge",
    rendererClass: "radial-gauge",
    Component: () => null,
  });
  const resolved = resolvePanelRegistrationByType(PANEL_GAUGE_TYPE);
  assert.equal(resolved.availability, "available");
  assert.equal(resolved.implementation?.kind, "contribution");
  assert.equal(resolved.descriptor?.rendererClass, "radial-gauge");
  assert.equal(resolved.descriptor?.sizing.minWidth, 2);
  assert.ok(listPanelRegistrations().some((e) => e.descriptor.type === PANEL_GAUGE_TYPE));
});

test("echarts panel resolves through registry", () => {
  const resolved = resolvePanelRegistrationByType("echarts");
  assert.equal(resolved.availability, "available");
  assert.equal(resolved.implementation?.kind, "echarts");
  assert.equal(resolved.descriptor?.rendererClass, "chart-canvas");
});

test("unknown panel type fails safely", () => {
  const panel = decodePanelInstance(
    panelInstance({ id: "u1", type: "some.future.panel", config: { custom: true } })
  );
  const resolved = resolvePanelRegistration(panel);
  assert.equal(resolved.availability, "unknown");
  assert.equal(resolved.implementation, null);
});

test("legacy plugin.clock migrates to core panel.clock", () => {
  const resolved = resolvePanelRegistrationByType("plugin.clock");
  assert.equal(resolved.availability, "available");
  assert.equal(resolved.descriptor?.type, "panel.clock");
});

test("configuration migration preserves unknown fields", () => {
  const w = panelInstance({
    id: "c1",
    type: "panel.test",
    config: { unknownFutureKey: "keep", panelScope: { systemIds: [] } },
  });
  registerContributionPanel({
    type: "panel.test",
    label: "Test",
    Component: () => null,
  });
  const migrated = migratePanelConfiguration(
    resolvePanelRegistrationByType("panel.test").descriptor,
    w
  );
  assert.equal(migrated.data.unknownFutureKey, "keep");
});

test("descriptor and implementation remain separate", () => {
  registerContributionPanel({
    type: "panel.test",
    label: "Test",
    Component: () => null,
  });
  const entry = listPanelRegistrations().find((e) => e.descriptor.type === "panel.test");
  assert.ok(entry);
  assert.equal(typeof entry!.descriptor.label, "string");
  assert.equal(entry!.implementation.kind, "contribution");
  assert.ok(entry!.implementation.Component);
  assert.equal((entry!.descriptor as { Component?: unknown }).Component, undefined);
});
