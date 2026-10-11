import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectBrokerIpFromSecretsYaml,
  detectBrokerIpFromEsphomeArchive,
} from "./esphome-cutover.js";

test("detects broker IP from secrets.yaml mqtt keys only", () => {
  const ip = detectBrokerIpFromSecretsYaml(`
mqtt_broker: "192.168.1.99"
wifi_ssid: Home
`);
  assert.equal(ip, "192.168.1.99");
});

test("detectBrokerIpFromEsphomeArchive ignores device yaml IPs", () => {
  const ip = detectBrokerIpFromEsphomeArchive([
    {
      rel: "garden.yaml",
      data: Buffer.from("web_server:\n  port: 80\n# device at 10.0.0.5\n"),
    },
  ]);
  assert.equal(ip, "");
});
