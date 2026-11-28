import assert from "node:assert/strict";
import { test } from "node:test";
import { hsToRgb, planItems, readStatus, rgbToHs, type ItemMap } from "./items.js";
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

test("Zherodius 2.5.1+ says what each reading is: new kinds need no Nexternel change", () => {
  const i: DeviceInfo = {
    ...info([
      { id: 3, type: "sensor", name: "Dust", model: "PMS5003", reads: ["pm25", "pm10", "pm1"] },
      { id: 4, type: "sensor", name: "Living room", model: "HLK-LD2410 / LD2410B", reads: ["pres", "dist"] },
      { id: 5, type: "sensor", name: "Hallway", model: "SCD40 / SCD41", reads: ["c", "t", "h"] },
      { id: 6, type: "sensor", name: "Odd", model: "X", reads: ["zzz", "bad key!"] },
    ]),
    measures: {
      pm25: { unit: "µg/m³", word: "PM2.5", type: "pm25" },
      pm10: { unit: "µg/m³", word: "PM10", type: "pm10" },
      pm1: { unit: "µg/m³", word: "PM1", type: "pm1" },
      pres: { unit: "", word: "presence", type: "presence", yesNo: true },
      dist: { unit: "cm", word: "distance", type: "distance" },
      c: { unit: "ppm", word: "CO2", type: "co2" },
      t: { unit: "°C", word: "temperature", type: "temperature" },
      h: { unit: "%", word: "humidity", type: "humidity" },
    },
  };
  const plan = planItems(i);
  assert.deepEqual(
    plan.map((p) => [p.slug, p.name, p.kind === "sensor" ? `${p.sensorType} ${p.unit}` : ""]),
    [
      ["sensor_3_pm25", "Dust PM2.5", "pm25 µg/m³"],
      ["sensor_3_pm10", "Dust PM10", "pm10 µg/m³"],
      ["sensor_3_pm1", "Dust PM1", "pm1 µg/m³"],
      ["sensor_4_pres", "Living room presence", "presence "],
      ["sensor_4_dist", "Living room distance", "distance cm"],
      ["sensor_5_c", "Hallway CO2", "co2 ppm"],
      ["sensor_5_t", "Hallway temperature", "temperature °C"],
      ["sensor_5_h", "Hallway humidity", "humidity %"],
    ]
  );
  const items: ItemMap = new Map([
    ["sensor_3_pm25", { itemId: "a", kind: "pm25" }],
    ["sensor_4_pres", { itemId: "b", kind: "binary_sensor" }],
    ["sensor_4_dist", { itemId: "c", kind: "number" }],
  ]);
  assert.deepEqual(
    readStatus({ sensors: [{ id: 3, pm25: 12, pm10: 20 }, { id: 4, pres: false }] }, items).map((r) => [r.itemId, r.value]),
    [
      ["a", 12],
      ["b", false],
      ["c", "nan"],
    ]
  );
});

test("wired contacts are Contact items (open = true); push buttons are not items", () => {
  const plan = planItems(
    info([
      { id: 2, type: "button", name: "Front door", kind: "contact" },
      { id: 3, type: "button", name: "Doorbell", kind: "push" },
      { id: 4, type: "button", name: "Old firmware button" },
    ])
  );
  assert.deepEqual(
    plan.map((p) => [p.slug, p.name, p.kind === "sensor" ? p.sensorType : ""]),
    [["contact_2", "Front door", "door"]]
  );
  const items: ItemMap = new Map([["contact_2", { itemId: "d", kind: "door" }]]);
  assert.deepEqual(
    readStatus({ buttons: [{ id: 2, pressed: true }, { id: 3, pressed: true }] }, items).map((r) => [r.itemId, r.value]),
    [["d", false]]
  );
  assert.deepEqual(
    readStatus({ buttons: [{ id: 2, pressed: false }] }, items).map((r) => [r.itemId, r.value]),
    [["d", true]]
  );
});

test("lights are light controls (colour only for WS2812B), the status light is not an item, buzzers are switches", () => {
  const plan = planItems(
    info([
      { id: 2, type: "light", name: "Porch", kind: "dimmable" },
      { id: 3, type: "light", name: "Shelf", kind: "colour" },
      { id: 4, type: "light", name: "Status", kind: "status" },
      { id: 5, type: "buzzer", name: "Door", ms: 1500 },
    ])
  );
  assert.deepEqual(
    plan.map((p) => [p.slug, p.name, p.kind, p.kind === "control" ? JSON.stringify(p.features) : ""]),
    [
      ["light_2", "Porch", "control", '{"brightness":true,"color":false}'],
      ["light_3", "Shelf", "control", '{"brightness":true,"color":true}'],
      ["buzzer_5", "Door", "relay", ""],
    ]
  );
  const items: ItemMap = new Map([
    ["light_2", { itemId: "p", kind: "light" }],
    ["light_3", { itemId: "s", kind: "light" }],
    ["buzzer_5", { itemId: "z", kind: "switch" }],
  ]);
  const r = readStatus(
    { lights: [{ id: 2, on: true, level: 40 }, { id: 3, on: false, level: 20, rgb: [255, 128, 0] }], buzzers: [{ id: 5, on: true }] },
    items
  );
  assert.deepEqual(
    r.map((x) => [x.itemId, x.value, x.control ?? false]),
    [
      ["p", { on: true, brightness: 40 }, true],
      ["s", { on: false, brightness: 20, color: { h: 30, s: 1 } }, true],
      ["z", true, false],
    ]
  );
});

test("colours: Zherodius red, green, blue <-> Nexternel hue and saturation", () => {
  assert.deepEqual(rgbToHs([255, 0, 0]), { h: 0, s: 1 });
  assert.deepEqual(rgbToHs([0, 0, 255]), { h: 240, s: 1 });
  assert.deepEqual(rgbToHs([255, 255, 255]), { h: 0, s: 0 });
  assert.equal(rgbToHs([1, 2]), undefined);
  assert.deepEqual(hsToRgb({ h: 30, s: 1 }), [255, 128, 0]);
  assert.deepEqual(hsToRgb({ h: 120, s: 0.5 }), [128, 255, 128]);
  assert.deepEqual(hsToRgb({ h: 0, s: 0 }), [255, 255, 255]);
  for (const c of [[255, 128, 0], [0, 255, 64], [200, 0, 255]] as [number, number, number][]) {
    const back = hsToRgb(rgbToHs(c)!);
    assert.ok(back.every((v, i) => Math.abs(v - c[i]!) <= 2), `${c} came back as ${back}`);
  }
});
