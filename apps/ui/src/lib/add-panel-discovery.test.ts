import assert from "node:assert/strict";
import test from "node:test";
import { groupAddPanelDiscovery, loadAddPanelDiscoveryCatalog } from "./add-panel-discovery.ts";

test("add panel lists weather and system under Generic, without a one-item group title", () => {
  const catalog = loadAddPanelDiscoveryCatalog();
  const labels = catalog.map((item) => item.label);
  assert.ok(labels.includes("Weather"));
  assert.ok(labels.includes("System information"));
  assert.ok(labels.includes("Clock"));
  assert.ok(labels.includes("Calendar"));

  const groups = groupAddPanelDiscovery(catalog);
  const generic = groups.find((group) => group.section === "system");
  assert.equal(generic?.label, "Generic");
  assert.deepEqual(
    generic?.items.map((item) => item.label),
    ["Clock", "Weather", "Calendar", "System information"]
  );

  const controls = groups.find((group) => group.section === "controls");
  assert.equal(controls?.items.length, 1);
  assert.equal(controls?.items[0]?.label, "Controls");
  assert.equal(controls?.items[0]?.description, "Switches you can turn on and off.");
});
