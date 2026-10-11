import assert from "node:assert/strict";
import test from "node:test";
import { DashboardDataRuntime } from "./runtime.js";
import { panelActivityIsActive } from "./types.js";

for (const panelCount of [1, 10, 50, 100]) {
  test(`${panelCount} Panel subscriptions share one live connection`, () => {
    let connections = 0;
    let disconnects = 0;
    const runtime = new DashboardDataRuntime(() => {
      connections += 1;
      return () => {
        disconnects += 1;
      };
    });

    runtime.start();
    runtime.start();
    const cleanups = Array.from({ length: panelCount }, (_, index) =>
      runtime.capabilities.subscribe([`cap-${index}`], () => undefined)
    );

    assert.equal(connections, 1);
    assert.equal(runtime.diagnostics().liveConnectionActive, true);
    assert.equal(runtime.diagnostics().capabilitySubscriptions, panelCount);

    for (const cleanup of cleanups) cleanup();
    assert.equal(runtime.diagnostics().capabilitySubscriptions, 0);
    runtime.stop();
    assert.equal(disconnects, 1);
  });
}

test("collapsed, hidden, and inactive lifecycle states suspend consumers", () => {
  assert.equal(panelActivityIsActive("visible"), true);
  assert.equal(panelActivityIsActive("hidden"), false);
  assert.equal(panelActivityIsActive("collapsed"), false);
  assert.equal(panelActivityIsActive("inactive"), false);
});
