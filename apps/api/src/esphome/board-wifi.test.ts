import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  boardWifiProblem,
  ensureEsphomeSecretsFile,
  readBoardWifi,
  readSecretValue,
  writeBoardWifi,
  writeSecretValue,
} from "./board-wifi.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nx-wifi-"));
}

test("a new home gets a settings file without Wi-Fi; the Wi-Fi is then set on screen", () => {
  const dir = tmpDir();
  assert.equal(ensureEsphomeSecretsFile(dir), true);
  assert.equal(ensureEsphomeSecretsFile(dir), false, "never changes an existing file");
  assert.deepEqual(readBoardWifi(dir), { ssid: null, passwordSet: false });
  writeBoardWifi({ ssid: "Home Net", password: "12345678" }, dir);
  assert.deepEqual(readBoardWifi(dir), { ssid: "Home Net", passwordSet: true });
  const text = fs.readFileSync(path.join(dir, "secrets.yaml"), "utf8");
  assert.match(text, /^wifi_password: "12345678"$/m, "numbers stay text");
  // Changing only the name keeps the saved password.
  writeBoardWifi({ ssid: "Other Net", password: "" }, dir);
  assert.equal(readSecretValue(fs.readFileSync(path.join(dir, "secrets.yaml"), "utf8"), "wifi_password"), "12345678");
});

test("an existing file keeps its other settings; placeholders count as not set", () => {
  const dir = tmpDir();
  fs.writeFileSync(
    path.join(dir, "secrets.yaml"),
    'wifi_ssid: "YOUR_WIFI_SSID"\nwifi_password: "YOUR_WIFI_PASSWORD"\nmqtt_broker: "10.0.0.2"\nnexternel_ap_password: "abc"\n'
  );
  assert.deepEqual(readBoardWifi(dir), { ssid: null, passwordSet: false });
  writeBoardWifi({ ssid: 'Rey"s "Wi-Fi"', password: "pa ss: #word" }, dir);
  const text = fs.readFileSync(path.join(dir, "secrets.yaml"), "utf8");
  assert.equal(readSecretValue(text, "wifi_ssid"), 'Rey"s "Wi-Fi"');
  assert.equal(readSecretValue(text, "wifi_password"), "pa ss: #word");
  assert.equal(readSecretValue(text, "mqtt_broker"), "10.0.0.2");
  assert.equal(readSecretValue(text, "nexternel_ap_password"), "abc");
});

test("plain-word problems", () => {
  assert.equal(boardWifiProblem({ ssid: " ", password: "x" }, false), "Type the name of your home Wi-Fi.");
  assert.equal(boardWifiProblem({ ssid: "a", password: "" }, false), "Type your Wi-Fi password.");
  assert.equal(boardWifiProblem({ ssid: "a", password: "" }, true), null);
  assert.equal(boardWifiProblem({ ssid: "a", password: "short" }, false), "A Wi-Fi password has 8 to 63 characters.");
  assert.equal(writeSecretValue("a: 1\n", "b", "x"), 'a: 1\nb: "x"\n');
});
