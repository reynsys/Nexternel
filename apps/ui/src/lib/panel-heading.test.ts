import assert from "node:assert/strict";
import test from "node:test";
import { decodePanelInstance } from "./panel-compatibility/normalize-panel.ts";
import { panelHeading, panelItemLabel } from "./panel-heading.ts";
import type { Capability, PanelInstance } from "../api.ts";

function cap(partial: Partial<Capability> & Pick<Capability, "id" | "name">): Capability {
  return {
    deviceId: "d1",
    deviceName: "Hall sensor",
    roomName: "Hall",
    kind: "temperature",
    unit: "°C",
    ...partial,
  } as Capability;
}

function panel(partial: Partial<PanelInstance>): PanelInstance {
  return {
    id: "p1",
    type: "panel.status",
    layout: { i: "p1", x: 0, y: 0, w: 4, h: 4 },
    bindings: {},
    config: {},
    ...partial,
  };
}

function runtimePanel(partial: Partial<PanelInstance>) {
  return decodePanelInstance(panel(partial));
}

test("one bound item puts its name and area in the title tile", () => {
  const heading = panelHeading(
    runtimePanel({
      type: "panel.gauge",
      bindings: { capabilityId: "temp" },
    }),
    [cap({ id: "temp", name: "Hallway Temperature" })]
  );
  assert.equal(heading.title, "Hallway Temperature");
  assert.equal(heading.area, "Hall");
  assert.equal(heading.ownsItemName, true);
});

test("an operator title stays, and the area still comes from the one item", () => {
  const heading = panelHeading(
    runtimePanel({
      title: "Landing",
      config: { panelScope: { contentMode: "manual", capabilityIds: ["temp"] } },
    }),
    [cap({ id: "temp", name: "Hallway Temperature" })]
  );
  assert.equal(heading.title, "Landing");
  assert.equal(heading.area, "Hall");
  assert.equal(heading.ownsItemName, true);
});

test("a calendar title is the month, in the same place as any other panel", () => {
  const heading = panelHeading(runtimePanel({ type: "panel.calendar" }), []);
  assert.equal(heading.title, new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }));
  assert.equal(heading.area, null);
  assert.equal(heading.ownsItemName, true);
});

test("a custom calendar title keeps the month as the area", () => {
  const heading = panelHeading(runtimePanel({ type: "panel.calendar", title: "Home" }), []);
  assert.equal(heading.title, "Home");
  assert.equal(heading.area, new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }));
});

test("weather is named Weather, and system uses one shared name", () => {
  const weather = panelHeading(
    runtimePanel({ type: "panel.weather", config: { weatherLocation: "York" } }),
    []
  );
  assert.equal(weather.title, "Weather");
  assert.equal(weather.area, "York");
  const system = panelHeading(runtimePanel({ type: "panel.system" }), []);
  assert.equal(system.title, "System information");
});

test("normalized config.scope drives single-item status headings", () => {
  const raw = panel({
    config: {
      panelScope: { contentMode: "manual", capabilityIds: ["temp"] },
    },
  });
  const runtime = decodePanelInstance(raw);
  const heading = panelHeading(runtime, [cap({ id: "temp", name: "Hallway Temperature" })]);
  assert.equal(heading.title, "Hallway Temperature");
  assert.equal(heading.area, "Hall");
  assert.equal(heading.ownsItemName, true);
});

test("weather place is the title tile area line", () => {
  const heading = panelHeading(
    runtimePanel({
      type: "panel.weather",
      config: { weatherLocation: "York", weatherLat: 0, weatherLon: 0 },
    }),
    []
  );
  assert.equal(heading.title, "Weather");
  assert.equal(heading.area, "York");
});

test("manual scope from normalized config.scope sets single-item title", () => {
  const raw = panel({
    type: "panel.charts",
    config: {
      configSchemaVersion: 1,
      scope: { contentMode: "manual", capabilityIds: ["temp"] },
    },
  });
  const runtime = decodePanelInstance(raw);
  const heading = panelHeading(runtime, [cap({ id: "temp", name: "Living room temp" })]);
  assert.equal(heading.title, "Living room temp");
  assert.equal(heading.ownsItemName, true);
});

test("multi chart panel with nothing shared uses Charts", () => {
  const heading = panelHeading(
    runtimePanel({
      type: "panel.charts",
      config: {
        scope: { contentMode: "manual", capabilityIds: ["a", "b"] },
      },
    }),
    [
      cap({ id: "a", name: "A", deviceName: "One", roomName: "Hall" }),
      cap({ id: "b", name: "B", deviceName: "Two", roomName: "Kitchen" }),
    ]
  );
  assert.equal(heading.title, "Charts");
  assert.equal(heading.itemPrefix, null);
  assert.equal(heading.ownsItemName, false);
});

test("several items from one device: device is the title, room the area, names lose the prefix", () => {
  const hallway = { deviceName: "Hallway Monitor", roomName: "Utility" };
  const heading = panelHeading(
    runtimePanel({
      config: { panelScope: { contentMode: "manual", capabilityIds: ["a", "b", "c"] } },
    }),
    [
      cap({ id: "a", name: "Hallway Monitor CO2", ...hallway }),
      cap({ id: "b", name: "Hallway Monitor Humidity", ...hallway }),
      cap({ id: "c", name: "Hallway Monitor Temperature", ...hallway }),
    ]
  );
  assert.equal(heading.title, "Hallway Monitor");
  assert.equal(heading.area, "Utility");
  assert.equal(heading.ownsItemName, false);
  assert.equal(panelItemLabel("Hallway Monitor CO2", heading.itemPrefix), "CO2");
  assert.equal(panelItemLabel("Hallway Monitor Humidity (%)", heading.itemPrefix), "Humidity (%)");
});

test("several devices in one room: room is the title", () => {
  const heading = panelHeading(
    runtimePanel({
      config: { panelScope: { contentMode: "manual", capabilityIds: ["a", "b"] } },
    }),
    [
      cap({ id: "a", name: "Kids Room Temperature", deviceName: "Readings", roomName: "Kids Room" }),
      cap({ id: "b", name: "Kids Room Lamp", deviceName: "Relay", roomName: "Kids Room" }),
    ]
  );
  assert.equal(heading.title, "Kids Room");
  assert.equal(heading.area, null);
  assert.equal(panelItemLabel("Kids Room Lamp", heading.itemPrefix), "Lamp");
});

test("operator title wins; shared device still trims item names", () => {
  const heading = panelHeading(
    runtimePanel({
      title: "Hall air",
      config: { panelScope: { contentMode: "manual", capabilityIds: ["a", "b"] } },
    }),
    [cap({ id: "a", name: "Hall sensor CO2" }), cap({ id: "b", name: "Hall sensor Humidity" })]
  );
  assert.equal(heading.title, "Hall air");
  assert.equal(heading.area, "Hall");
  assert.equal(panelItemLabel("Hall sensor CO2", heading.itemPrefix), "CO2");
});

test("item label keeps names that only look like the prefix", () => {
  assert.equal(panelItemLabel("Hallways", "Hallway"), "Hallways");
  assert.equal(panelItemLabel("Hallway", "Hallway"), "Hallway");
  assert.equal(panelItemLabel("Lamp", null), "Lamp");
});

test("camera panel keeps operator title only; area stays on each camera item", () => {
  const heading = panelHeading(
    runtimePanel({
      type: "panel.camera",
      title: "CCTV",
      config: { scope: { contentMode: "auto", areaIds: ["garden"] } },
    }),
    [cap({ id: "temp", name: "Garden temp", roomName: "Garden", areaId: "garden" })],
    "garden"
  );
  assert.equal(heading.title, "CCTV");
  assert.equal(heading.area, null);
  assert.equal(heading.ownsItemName, false);
});

test("camera panel never puts capability area in the title tile", () => {
  const heading = panelHeading(
    runtimePanel({
      type: "panel.camera",
      title: "Cameras",
      bindings: { capabilityId: "temp" },
    }),
    [cap({ id: "temp", name: "Driveway sensor", roomName: "Driveway" })],
    "driveway"
  );
  assert.equal(heading.title, "Cameras");
  assert.equal(heading.area, null);
});
