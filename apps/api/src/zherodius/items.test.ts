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
