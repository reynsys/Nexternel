import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteDeviceMqttYaml, rewriteEsphomeSecretsYaml } from "../migrate/esphome-rewrite.js";

const SAMPLE_DEVICE_YAML = `
esphome:
  name: garden-relays
  friendly_name: Garden Relays

esp32:
  board: esp32dev
  framework:
    type: arduino

switch:
  - platform: gpio
    pin: GPIO16
    name: "Pump Relay"
    id: pump_relay

sensor:
  - platform: dht
    pin: GPIO4
    temperature:
      name: "Garden Temp"
    humidity:
      name: "Garden Humidity"

mqtt:
  broker: 192.168.1.50
  port: 1883
  username: olduser
  password: oldpass
  topic_prefix: damnhome/garden-relays
`;

test("rewriteDeviceMqttYaml updates mqtt block only", () => {
  const out = rewriteDeviceMqttYaml(SAMPLE_DEVICE_YAML, {
    brokerIp: "192.168.4.10",
    mqttUsername: "nexternel",
    mqttPassword: "newpass",
    topicPrefix: "nexternel/garden-relays",
  });
  assert.match(out, /broker: 192\.168\.4\.10/);
  assert.match(out, /topic_prefix: nexternel\/garden-relays/);
  assert.match(out, /pin: GPIO16/);
  assert.match(out, /pin: GPIO4/);
  assert.match(out, /name: "Pump Relay"/);
  assert.doesNotMatch(out, /192\.168\.1\.50/);
});

test("rewriteEsphomeSecretsYaml updates infrastructure keys only", () => {
  const secrets = `
mqtt_broker: 192.168.1.50
mqtt_username: old
mqtt_password: old
wifi_ssid: HomeNet
wifi_password: secret
api_key: abc123
`;
  const out = rewriteEsphomeSecretsYaml(secrets, {
    brokerIp: "192.168.4.10",
    mqttUsername: "nexternel",
    mqttPassword: "newpass",
  });
  assert.match(out, /mqtt_broker: 192\.168\.4\.10/);
  assert.match(out, /mqtt_username: nexternel/);
  assert.match(out, /wifi_ssid: HomeNet/);
  assert.match(out, /api_key: abc123/);
});
