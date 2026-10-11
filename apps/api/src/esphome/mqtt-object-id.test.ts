import assert from "node:assert/strict";
import test from "node:test";
import { esphomeMqttObjectId, esphomeObjectIdFromName } from "./yaml.js";

test("MQTT object id follows ESPHome: spaces → _, hyphens kept, other symbols → _", () => {
  // Names from the live Glow meter; its readings are stored under these ids.
  assert.equal(esphomeMqttObjectId("House - Daily Energy"), "house_-_daily_energy");
  assert.equal(esphomeMqttObjectId("House - Power Consumption"), "house_-_power_consumption");
  assert.equal(esphomeMqttObjectId("Glow - Installed Version"), "glow_-_installed_version");
  assert.equal(esphomeMqttObjectId("Hallway Monitor CO2"), "hallway_monitor_co2");
  assert.equal(esphomeMqttObjectId("PM 2.5"), "pm_2_5");
});

test("generated YAML ids still never contain hyphens", () => {
  assert.equal(esphomeObjectIdFromName("House - Daily Energy"), "house_daily_energy");
});
