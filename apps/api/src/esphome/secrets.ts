import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { esphomeDir, pathExists } from "../migrate/paths.js";
import { parseSimpleSecretsYaml } from "../migrate/flash-yaml.js";

const WIFI_PLACEHOLDER_PATTERNS = [
  /^YOUR_WIFI_SSID$/i,
  /^YOUR_WIFI_PASSWORD$/i,
  /^change_me/i,
  /^your_wifi/i,
  /^example$/i,
];

export type EsphomeBuildPrerequisites = {
  ready: boolean;
  missing: string[];
  wifiConfigured: boolean;
  secretsFileExists: boolean;
};

/** Merge esphome/secrets.yaml with live MQTT settings from .env (same as flash-yaml). */
export function loadEsphomeSecretsMerged(): Record<string, string> {
  const root = esphomeDir();
  const secretsPath = path.join(root, "secrets.yaml");
  const secretsYml = path.join(root, "secrets.yml");
  let raw = "";
  if (pathExists(secretsPath)) {
    raw = fs.readFileSync(secretsPath, "utf8");
  } else if (pathExists(secretsYml)) {
    raw = fs.readFileSync(secretsYml, "utf8");
  }

  const secrets = raw ? parseSimpleSecretsYaml(raw) : {};
  const brokerIp = (config.serverIp() || secrets.mqtt_broker || "").trim();
  const mqttUser = (config.mqttUsername() || secrets.mqtt_username || "").trim();
  const mqttPass = (config.mqttPassword() || secrets.mqtt_password || "").trim();

  if (brokerIp) secrets.mqtt_broker = brokerIp;
  if (mqttUser) secrets.mqtt_username = mqttUser;
  if (mqttPass) secrets.mqtt_password = mqttPass;

  return secrets;
}

function isPlaceholderWifiValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return WIFI_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Check Wi-Fi / MQTT secrets required before `esphome compile` for Device Builder devices. */
export function checkEsphomeBuildPrerequisites(): EsphomeBuildPrerequisites {
  const root = esphomeDir();
  const secretsFileExists =
    pathExists(path.join(root, "secrets.yaml")) ||
    pathExists(path.join(root, "secrets.yml"));

  const secrets = loadEsphomeSecretsMerged();
  const missing: string[] = [];

  if (!secretsFileExists) {
    missing.push(
      "esphome/secrets.yaml is missing — copy esphome/secrets.yaml.example to secrets.yaml on the server"
    );
  }

  const wifiSsid = (secrets.wifi_ssid || "").trim();
  const wifiPassword = secrets.wifi_password ?? "";
  if (!wifiSsid) {
    missing.push("wifi_ssid in esphome/secrets.yaml");
  }
  if (wifiPassword === "") {
    missing.push("wifi_password in esphome/secrets.yaml");
  }
  if (
    isPlaceholderWifiValue(wifiSsid) ||
    isPlaceholderWifiValue(wifiPassword)
  ) {
    missing.push(
      "Wi-Fi credentials in esphome/secrets.yaml still use placeholder values"
    );
  }

  if (!(secrets.mqtt_broker || "").trim()) {
    missing.push("mqtt_broker (set SERVER_IP in .env or secrets.yaml)");
  }
  if (!(secrets.mqtt_username || "").trim()) {
    missing.push("mqtt_username (MQTT_USERNAME in .env)");
  }
  if ((secrets.mqtt_password ?? "") === "") {
    missing.push("mqtt_password (MQTT_PASSWORD in .env)");
  }

  return {
    ready: missing.length === 0,
    missing,
    wifiConfigured: Boolean(wifiSsid && wifiPassword !== ""),
    secretsFileExists,
  };
}

export function assertEsphomeBuildPrerequisites(): void {
  const check = checkEsphomeBuildPrerequisites();
  if (!check.ready) {
    throw new Error(
      `Cannot build firmware — ${check.missing.join("; ")}. Edit esphome/secrets.yaml on the server, then try again.`
    );
  }
}
