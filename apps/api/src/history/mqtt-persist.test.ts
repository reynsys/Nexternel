import assert from "node:assert/strict";
import test from "node:test";
import { parseMqttSensorStateTopic } from "./mqtt-persist.js";

test("parseMqttSensorStateTopic reads device and entity from Nexternel sensor state topics", () => {
  const parsed = parseMqttSensorStateTopic(
    "nexternel/hallway-monitor/sensor/hallway_monitor_co2/state"
  );
  assert.deepEqual(parsed, {
    deviceSlug: "hallway-monitor",
    entityId: "hallway_monitor_co2",
  });
});

test("parseMqttSensorStateTopic ignores non-sensor topics", () => {
  assert.equal(
    parseMqttSensorStateTopic("nexternel/hallway-monitor/switch/relay/state"),
    null
  );
});
