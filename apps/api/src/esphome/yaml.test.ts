import test from "node:test";
import assert from "node:assert/strict";
import { parseEsphomeYaml } from "./yaml.js";

/** Minimal DHT-only ESPHome YAML (no switch section) — self-contained for Docker build. */
const DHT_ONLY_YAML = `
substitutions:
  device_name: kids-room
  mqtt_topic_prefix: nexternel/kids-room

esphome:
  name: "\${device_name}"

mqtt:
  topic_prefix: \${mqtt_topic_prefix}

sensor:
  - platform: dht
    pin: GPIO2
    temperature:
      name: "Kids Room Temperature"
      id: kids_room_temperature
      unit_of_measurement: "°C"
    humidity:
      name: "Kids Room Humidity"
      id: kids_room_humidity
      unit_of_measurement: "%"
    update_interval: 60s
`;

test("DHT-only YAML has sensors but no relays", () => {
  const parsed = parseEsphomeYaml(DHT_ONLY_YAML, "kids-room", "kids-room");
  assert.equal(parsed.esphomeName, "kids-room");
  assert.ok(parsed.sensors.length >= 2);
  assert.equal(parsed.relays.length, 0);
});

test("YAML with switch section parses relays; DHT fixture has none", () => {
  const withSwitch = parseEsphomeYaml(
    `${DHT_ONLY_YAML}
switch:
  - platform: gpio
    pin: GPIO4
    name: "Garden Light"
    id: garden_light
`,
    "garden",
    "garden"
  );
  assert.equal(withSwitch.relays.length, 1);
  assert.equal(parseEsphomeYaml(DHT_ONLY_YAML, "kids-room", "kids-room").relays.length, 0);
});
