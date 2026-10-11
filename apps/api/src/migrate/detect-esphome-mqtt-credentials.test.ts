import assert from "node:assert/strict";
import { test } from "node:test";
import { extractEsphomeMqttCredential } from "./detect-esphome-mqtt-credentials.js";

const SAMPLE = `
substitutions:
  device_name: air-quality
  mqtt_broker: "192.168.7.101"
  mqtt_username: "damn_nexternel"
  mqtt_password: "example-mqtt-pass"

esphome:
  name: air-quality
`;

test("extractEsphomeMqttCredential reads substitutions mqtt_username", () => {
  const cred = extractEsphomeMqttCredential("air-quality.yaml", SAMPLE);
  assert.equal(cred?.username, "damn_nexternel");
  assert.equal(cred?.password, "example-mqtt-pass");
});

test("extractEsphomeMqttCredential reads secrets.yaml", () => {
  const cred = extractEsphomeMqttCredential(
    "secrets.yaml",
    `mqtt_username: damn_nexternel\nmqtt_password: secret_pass\n`
  );
  assert.equal(cred?.username, "damn_nexternel");
  assert.equal(cred?.password, "secret_pass");
});
