import assert from "node:assert/strict";
import test from "node:test";
import { resolveSensorEntityIdForHistory } from "./entity-id.js";

test("resolveSensorEntityIdForHistory prefers MQTT topic entity segment over hyphen slug", () => {
  const entityId = resolveSensorEntityIdForHistory({
    slug: "hallway-monitor-co2",
    esphome_entity_id: null,
    mqtt_state_topic:
      "nexternel/hallway-monitor/sensor/hallway_monitor_co2/state",
  });
  assert.equal(entityId, "hallway_monitor_co2");
});

test("resolveSensorEntityIdForHistory uses esphome_entity_id when topic missing", () => {
  const entityId = resolveSensorEntityIdForHistory({
    slug: "hallway-monitor-co2",
    esphome_entity_id: "hallway_monitor_co2",
    mqtt_state_topic: null,
  });
  assert.equal(entityId, "hallway_monitor_co2");
});

test("resolveSensorEntityIdForHistory prefers MQTT topic over stale esphome_entity_id", () => {
  const entityId = resolveSensorEntityIdForHistory({
    slug: "hallway-monitor-co2",
    esphome_entity_id: "hallway-monitor-co2",
    mqtt_state_topic:
      "nexternel/hallway-monitor/sensor/hallway_monitor_co2/state",
  });
  assert.equal(entityId, "hallway_monitor_co2");
});

test("resolveSensorEntityIdForHistory keeps an ESPHome id that contains a hyphen", () => {
  const entityId = resolveSensorEntityIdForHistory({
    slug: "house-power-consumption",
    esphome_entity_id: "house_-_power_consumption",
    mqtt_state_topic:
      "nexternel/glow-energy/sensor/house_-_power_consumption/state",
  });
  assert.equal(entityId, "house_-_power_consumption");
});

test("resolveSensorEntityIdForHistory corrects stale hyphenated mqtt_state_topic", () => {
  const entityId = resolveSensorEntityIdForHistory({
    slug: "hallway-monitor-co2",
    esphome_entity_id: null,
    mqtt_state_topic:
      "nexternel/hallway-monitor/sensor/hallway-monitor-co2/state",
  });
  assert.equal(entityId, "hallway_monitor_co2");
});
