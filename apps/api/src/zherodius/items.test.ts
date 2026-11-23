import assert from "node:assert/strict";
import { test } from "node:test";
import { planItems, readStatus, type ItemMap } from "./items.js";
import type { DeviceInfo } from "./line.js";

const info = (parts: DeviceInfo["parts"]): DeviceInfo => ({ name: "Garden Relays", serial: "ZH-1", board: "b", version: "1.10.2", mac: "", parts });

test("relays become switches; sensors one item per reading they take", () => {
  const plan = planItems(
    info([
      { id: 1, type: "relay", name: "Pump" },
      { id: 3, type: "sensor", name: "Shed", model: "SHT4x" },
      { id: 4, type: "sensor", name: "Pond", model: "DS18B20" },
      { id: 5, type: "sensor", name: "Air", model: "BME280" },
      { id: 6, type: "button", name: "Button" },
    ])
  );
  assert.deepEqual(
    plan.map((p) => [p.slug, p.name]),
    [
      ["relay_1", "Pump"],
      ["sensor_3_t", "Shed temperature"],
      ["sensor_3_h", "Shed humidity"],
      ["sensor_4_t", "Pond"],
      ["sensor_5_t", "Air temperature"],
      ["sensor_5_h", "Air humidity"],
      ["sensor_5_p", "Air pressure"],
    ]
  );
  const pond = plan.find((p) => p.slug === "sensor_4_t");
  assert.equal(pond?.kind === "sensor" && `${pond.sensorType} ${pond.unit}`, "temperature °C");
});

test("a device that lists what a sensor reads is followed", () => {
  const plan = planItems(info([{ id: 3, type: "sensor", name: "Odd", model: "sensor", reads: ["p"] }]));
  assert.deepEqual(plan.map((p) => p.slug), ["sensor_3_p"]);
});

test("an electricity meter gives power now (W) and energy so far (kWh)", () => {
  const plan = planItems(info([{ id: 7, type: "sensor", name: "House", model: "Electricity meter", reads: ["w", "e"] }]));
  assert.deepEqual(
    plan.map((p) => [p.slug, p.name, p.kind === "sensor" ? `${p.sensorType} ${p.unit}` : ""]),
    [
      ["sensor_7_w", "House power", "power W"],
      ["sensor_7_e", "House energy", "energy kWh"],
    ]
  );
  const items: ItemMap = new Map([
    ["sensor_7_w", { itemId: "w", kind: "power" }],
    ["sensor_7_e", { itemId: "e", kind: "energy" }],
  ]);
  assert.deepEqual(
    readStatus({ sensors: [{ id: 7, w: 530, e: 1234.567 }] }, items).map((r) => [r.itemId, r.value]),
    [
      ["w", 530],
      ["e", 1234.567],
    ]
  );
});

test("an unknown sensor model gives no guessed items", () => {
  assert.deepEqual(planItems(info([{ id: 3, type: "sensor", name: "New", model: "XYZ9" }])), []);
});

test("a status becomes one report per item; a reading the sensor did not take is 'nan'", () => {
  const items: ItemMap = new Map([
    ["relay_1", { itemId: "a", kind: "switch" }],
    ["sensor_3_t", { itemId: "b", kind: "temperature" }],
    ["sensor_3_h", { itemId: "c", kind: "humidity" }],
  ]);
  const reports = readStatus({ relays: [{ id: 1, on: true }, { id: 9, on: true }], sensors: [{ id: 3, t: 21.5 }] }, items);
  assert.deepEqual(
    reports.map((r) => [r.itemId, r.value]),
    [
      ["a", true],
      ["b", 21.5],
      ["c", "nan"],
    ]
  );
});

test("Nexternel's name for the device fits in 32 bytes without cutting a letter", async () => {
  const { fitHubName } = await import("./service.js");
  assert.equal(fitHubName("Nexternel at 192.168.1.40"), "Nexternel at 192.168.1.40");
  assert.equal(Buffer.byteLength(fitHubName("Ж".repeat(40))), 32);
  assert.equal(fitHubName("The Taylors' house in the country, Devon"), "The Taylors' house in the countr");
});

test("a CO2 sensor (SCD4x) gives CO2, temperature and humidity", () => {
  const plan = planItems(info([{ id: 2, type: "sensor", name: "Hallway Monitor", model: "SCD4x", reads: ["c", "t", "h"] }]));
  assert.deepEqual(
    plan.map((p) => [p.slug, p.name, p.kind === "sensor" ? `${p.sensorType} ${p.unit}` : ""]),
    [
      ["sensor_2_c", "Hallway Monitor CO2", "co2 ppm"],
      ["sensor_2_t", "Hallway Monitor temperature", "temperature °C"],
      ["sensor_2_h", "Hallway Monitor humidity", "humidity %"],
    ]
  );
  const items: ItemMap = new Map([["sensor_2_c", { itemId: "c1", kind: "co2" }]]);
  assert.deepEqual(readStatus({ sensors: [{ id: 2, c: 612, t: 21.4, h: 48 }] }, items), [{ itemId: "c1", value: 612, kind: "co2", slug: "sensor_2_c" }]);
});
