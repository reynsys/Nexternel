import assert from "node:assert/strict";
import test from "node:test";
import { groupAddPanelDiscovery, loadAddPanelDiscoveryCatalog } from "./add-panel-discovery.ts";

test("add panel groups: readings, switches and cameras, information", () => {
  const catalog = loadAddPanelDiscoveryCatalog();
  const labels = catalog.map((item) => item.label);
  assert.ok(labels.includes("Weather"));
  assert.ok(labels.includes("System information"));
  assert.ok(labels.includes("Clock"));
  assert.ok(labels.includes("Calendar"));

  const groups = groupAddPanelDiscovery(catalog);
  assert.deepEqual(groups.slice(0, 3).map((g) => g.label), ["Readings", "Switches and cameras", "Information"]);
  const generic = groups.find((group) => group.section === "information");
  assert.deepEqual(
    generic?.items.map((item) => item.label),
    ["Clock", "Weather", "Calendar", "System information", "Rooms"]
  );

  const switches = groups.find((group) => group.section === "switches");
  assert.deepEqual(switches?.items.map((item) => item.label), ["Controls", "Cameras"]);
  assert.equal(switches?.items[0]?.description, "Switches you can turn on and off.");
});
