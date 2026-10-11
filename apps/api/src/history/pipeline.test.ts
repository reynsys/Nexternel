import assert from "node:assert/strict";
import test from "node:test";
import { resolveSensorEntityIdForHistory } from "./entity-id.js";
import {
  formatSensorReadingLine,
  parseMqttSensorStateTopic,
  persistMqttSensorHistory,
} from "./mqtt-persist.js";
import { parseMqttPayload } from "../telemetry/state-cache.js";

/** Legacy history lookup before V4.0.134 — caused empty chart queries. */
function legacyHistoryEntityId(sensor: {
  slug: string;
  esphome_entity_id: string | null;
}): string {
  return sensor.esphome_entity_id || sensor.slug;
}

function sensorRow(input: {
  slug: string;
  esphome_entity_id?: string | null;
  mqtt_state_topic?: string | null;
}) {
  return {
    slug: input.slug,
    esphome_entity_id: input.esphome_entity_id ?? null,
    mqtt_state_topic: input.mqtt_state_topic ?? null,
  };
}

// Test A — ordinary ESPHome temperature (Living Room)
test("Test A — living_room_temperature resolves for history query", () => {
  const topic = "nexternel/living-room/sensor/living_room_temperature/state";
  const parsed = parseMqttSensorStateTopic(topic);
  assert.deepEqual(parsed, {
    deviceSlug: "living-room",
    entityId: "living_room_temperature",
  });

  const row = sensorRow({
    slug: "living-room-temperature",
    esphome_entity_id: "living_room_temperature",
    mqtt_state_topic: topic,
  });
  assert.equal(resolveSensorEntityIdForHistory(row), "living_room_temperature");
  assert.equal(legacyHistoryEntityId(row), "living_room_temperature");
});

// Test B — ESPHome CO₂ (Hallway Monitor)
test("Test B — hallway_monitor_co2 resolves for history query", () => {
  const topic = "nexternel/hallway-monitor/sensor/hallway_monitor_co2/state";
  const influxEntity = parseMqttSensorStateTopic(topic)!.entityId;

  const row = sensorRow({
    slug: "hallway-monitor-co2",
    esphome_entity_id: null,
    mqtt_state_topic: topic,
  });

  assert.equal(influxEntity, "hallway_monitor_co2");
  assert.equal(legacyHistoryEntityId(row), "hallway-monitor-co2");
  assert.notEqual(legacyHistoryEntityId(row), influxEntity);
  assert.equal(resolveSensorEntityIdForHistory(row), influxEntity);
  assert.equal(parseMqttPayload("co2", "594"), 594);
});

// Test C — hyphen slug vs underscore MQTT entity
test("Test C — hyphen slug maps to underscore entity for history", () => {
  const topic = "nexternel/hallway-monitor/sensor/hallway_monitor_co2/state";
  const row = sensorRow({
    slug: "hallway-monitor-co2",
    esphome_entity_id: null,
    mqtt_state_topic: topic,
  });
  assert.equal(resolveSensorEntityIdForHistory(row), "hallway_monitor_co2");
});

test("Test C — stale hyphenated mqtt_state_topic still resolves via slug", () => {
  const staleTopic =
    "nexternel/hallway-monitor/sensor/hallway-monitor-co2/state";
  const row = sensorRow({
    slug: "hallway-monitor-co2",
    esphome_entity_id: null,
    mqtt_state_topic: staleTopic,
  });
  assert.equal(resolveSensorEntityIdForHistory(row), "hallway_monitor_co2");
});

// Test D — another numeric sensor (humidity / pressure)
test("Test D — humidity and pressure use the same generic resolution", () => {
  const humidityTopic =
    "nexternel/hallway-monitor/sensor/hallway_monitor_humidity/state";
  const pressureTopic =
    "nexternel/garage/sensor/garage_pressure/state";

  assert.equal(
    resolveSensorEntityIdForHistory(
      sensorRow({
        slug: "hallway-monitor-humidity",
        mqtt_state_topic: humidityTopic,
      })
    ),
    "hallway_monitor_humidity"
  );
  assert.equal(
    resolveSensorEntityIdForHistory(
      sensorRow({
        slug: "garage-pressure",
        mqtt_state_topic: pressureTopic,
      })
    ),
    "garage_pressure"
  );
  assert.equal(parseMqttPayload("humidity", "50"), 50);
  assert.equal(parseMqttPayload("pressure", "1013.2"), 1013.2);
});

// Test E — writer uses generic sensor_reading line protocol (no CO₂ branch)
test("Test E — history writer line protocol matches the stored history schema for all sensors", () => {
  const tempLine = formatSensorReadingLine({
    deviceSlug: "living-room",
    entityId: "living_room_temperature",
    value: 22.4,
    timestampMs: 1_700_000_000_000,
  });
  assert.match(
    tempLine,
    /^sensor_reading,device=living-room,entity_type=sensor,entity_id=living_room_temperature value=22\.4 1700000000000$/
  );

  const co2Line = formatSensorReadingLine({
    deviceSlug: "hallway-monitor",
    entityId: "hallway_monitor_co2",
    value: 594,
    timestampMs: 1_700_000_000_000,
  });
  assert.match(
    co2Line,
    /^sensor_reading,device=hallway-monitor,entity_type=sensor,entity_id=hallway_monitor_co2 value=594 1700000000000$/
  );
});

test("Test E — storing a reading never throws, even without InfluxDB", () => {
  assert.doesNotThrow(() => {
    persistMqttSensorHistory(
      "nexternel/hallway-monitor/sensor/hallway_monitor_co2/state",
      594
    );
  });
});
