/**
 * Build flash-ready ESPHome YAML from this server’s settings.
 * Inlines broker IP, Wi‑Fi, and MQTT credentials so the file is self-contained
 * (visible IP — no !secret) for USB / web.esphome.io installs.
 */

import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { getPool } from "../db.js";
import { config } from "../config.js";
import { esphomeDir, isDirectory, listEsphomeFiles, pathExists } from "./paths.js";
import {
  rewriteDeviceMqttYaml,
  rewriteEsphomeSecretsYaml,
} from "./esphome-rewrite.js";

function quoteYamlScalar(value: string): string {
  if (value.startsWith("!secret ")) return value;
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || /\s/.test(value) || value === "") {
    return JSON.stringify(value);
  }
  return value;
}

/** Parse flat `key: value` secrets.yaml (ESPHome style). */
export function parseSimpleSecretsYaml(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = /^([A-Za-z0-9_]+)\s*:\s*(.*?)\s*$/.exec(trimmed);
    if (!m) continue;
    let v = m[2] ?? "";
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]!] = v;
  }
  return out;
}

function loadSecretsMerged(): Record<string, string> {
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

  // Prefer live server .env over stale secrets for MQTT
  if (brokerIp) secrets.mqtt_broker = brokerIp;
  if (mqttUser) secrets.mqtt_username = mqttUser;
  if (mqttPass) secrets.mqtt_password = mqttPass;

  return secrets;
}

function setWifiBlock(
  content: string,
  ssid: string,
  password: string
): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inWifi = false;
  let wifiIndent = 0;
  /** Indent of direct children under `wifi:` (ssid/password). Nested keys (e.g. ap:) are deeper. */
  let childIndent = 2;
  const seen = new Set<string>();

  const flush = (indent: string) => {
    if (!seen.has("ssid")) {
      out.push(`${indent}ssid: ${quoteYamlScalar(ssid)}`);
    }
    if (!seen.has("password")) {
      out.push(`${indent}password: ${quoteYamlScalar(password)}`);
    }
  };

  for (const line of lines) {
    const header = /^(\s*)wifi:\s*(?:#.*)?$/.exec(line);
    if (header) {
      if (inWifi) flush(" ".repeat(childIndent));
      inWifi = true;
      wifiIndent = header[1].length;
      childIndent = wifiIndent + 2;
      seen.clear();
      out.push(line);
      continue;
    }
    if (inWifi) {
      if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
        out.push(line);
        continue;
      }
      const keyLine = /^(\s*)([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
      if (!keyLine) {
        out.push(line);
        continue;
      }
      const ind = keyLine[1].length;
      if (ind <= wifiIndent) {
        flush(" ".repeat(childIndent));
        inWifi = false;
        out.push(line);
        continue;
      }
      // Nested map under wifi (ap:, networks:, manual_ip:, etc.) — leave untouched
      if (ind > childIndent) {
        out.push(line);
        continue;
      }
      // Direct child of wifi:
      const key = keyLine[2];
      const rest = (keyLine[3] ?? "").trim();
      // Starting a nested block (e.g. `ap:`) — do not treat as station ssid/password
      if (rest === "" || rest.startsWith("#")) {
        out.push(line);
        continue;
      }
      if (key === "ssid") {
        out.push(`${keyLine[1]}ssid: ${quoteYamlScalar(ssid)}`);
        seen.add("ssid");
        continue;
      }
      if (key === "password") {
        out.push(`${keyLine[1]}password: ${quoteYamlScalar(password)}`);
        seen.add("password");
        continue;
      }
      out.push(line);
      continue;
    }
    out.push(line);
  }
  if (inWifi) flush(" ".repeat(childIndent));
  return out.join("\n");
}

function banner(brokerIp: string, topicPrefix: string): string {
  return [
    `# Nexternel flash-ready YAML — generated from THIS server's settings`,
    `# Broker IP, Wi‑Fi, and MQTT password are inlined below (no secrets.yaml needed).`,
    `# MQTT broker: ${brokerIp}  ·  topic_prefix: ${topicPrefix}`,
    `# Flash: ESPHome → Install → "Plug into this computer" (USB), or https://web.esphome.io`,
    `# Do not commit this file — it contains Wi‑Fi / MQTT passwords.`,
    "",
  ].join("\n");
}

/** Strip old header comments; keep body from first non-comment/esphome key. */
function stripLeadingComments(content: string): string {
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const t = lines[i]!.trim();
    if (t === "" || t.startsWith("#")) {
      i += 1;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n");
}

export function buildFlashReadyYaml(
  deviceYaml: string,
  opts: {
    brokerIp: string;
    mqttUsername: string;
    mqttPassword: string;
    topicPrefix: string;
    wifiSsid: string;
    wifiPassword: string;
  }
): string {
  let text = stripLeadingComments(deviceYaml);
  text = rewriteDeviceMqttYaml(text, {
    brokerIp: opts.brokerIp,
    mqttUsername: opts.mqttUsername,
    mqttPassword: opts.mqttPassword,
    topicPrefix: opts.topicPrefix,
  });
  // Force inline MQTT (rewrite keeps !secret when secrets were detected)
  text = text.replace(
    /^(\s*broker:\s*)!secret\s+\S+/im,
    `$1${quoteYamlScalar(opts.brokerIp)}`
  );
  text = text.replace(
    /^(\s*username:\s*)!secret\s+\S+/im,
    `$1${quoteYamlScalar(opts.mqttUsername)}`
  );
  text = text.replace(
    /^(\s*password:\s*)!secret\s+\S+/im,
    `$1${quoteYamlScalar(opts.mqttPassword)}`
  );
  // Also replace hardcoded username with server user
  text = text.replace(
    /^(\s*username:\s*).*$/im,
    `$1${quoteYamlScalar(opts.mqttUsername)}`
  );
  text = setWifiBlock(text, opts.wifiSsid, opts.wifiPassword);
  return `${banner(opts.brokerIp, opts.topicPrefix)}${text.replace(/\s*$/, "")}\n`;
}

function requireFlashSettings(secrets: Record<string, string>): {
  brokerIp: string;
  mqttUsername: string;
  mqttPassword: string;
  wifiSsid: string;
  wifiPassword: string;
} {
  const brokerIp = (secrets.mqtt_broker || "").trim();
  const mqttUsername = (secrets.mqtt_username || "").trim();
  const mqttPassword = secrets.mqtt_password ?? "";
  const wifiSsid = (secrets.wifi_ssid || "").trim();
  const wifiPassword = secrets.wifi_password ?? "";

  const missing: string[] = [];
  if (!brokerIp) missing.push("mqtt_broker (set SERVER_IP in .env or secrets.yaml)");
  if (!mqttUsername) missing.push("mqtt_username (MQTT_USERNAME in .env)");
  if (!mqttPassword) missing.push("mqtt_password (MQTT_PASSWORD in .env)");
  if (!wifiSsid) missing.push("wifi_ssid (in esphome/secrets.yaml — Adopt with Wi‑Fi, or edit secrets)");
  if (wifiPassword === "") missing.push("wifi_password (in esphome/secrets.yaml)");

  if (missing.length) {
    throw new Error(
      `Cannot build flash YAML — missing: ${missing.join("; ")}`
    );
  }

  return { brokerIp, mqttUsername, mqttPassword, wifiSsid, wifiPassword };
}

function findDeviceYaml(stem: string): { rel: string; text: string } | null {
  const want = stem.toLowerCase().replace(/\.ya?ml$/i, "");
  for (const { rel, data } of listEsphomeFiles()) {
    if (!/\.ya?ml$/i.test(rel)) continue;
    const base = path.basename(rel, path.extname(rel)).toLowerCase();
    if (base === "secrets") continue;
    if (base === want) {
      return { rel, text: data.toString("utf8") };
    }
  }
  return null;
}

async function topicPrefixForStem(stem: string): Promise<string> {
  const want = stem.toLowerCase();
  const { rows } = await getPool().query<{
    mqtt_topic_prefix: string;
    esphome_name: string | null;
    slug: string;
  }>(
    `SELECT mqtt_topic_prefix, esphome_name, slug FROM devices
     WHERE lower(coalesce(esphome_name, '')) = $1 OR lower(slug) = $1
     LIMIT 1`,
    [want]
  );
  if (rows[0]?.mqtt_topic_prefix) return rows[0].mqtt_topic_prefix;
  const root = (process.env.MQTT_TOPIC_PREFIX || "nexternel").trim();
  return `${root}/${want}`;
}

export async function createFlashReadyYamlForStem(stem: string): Promise<{
  yaml: string;
  filename: string;
  brokerIp: string;
  topicPrefix: string;
}> {
  if (!isDirectory(esphomeDir())) {
    throw new Error("ESPHome folder is not mounted on the API");
  }
  const found = findDeviceYaml(stem);
  if (!found) {
    throw new Error(
      `No ESPHome YAML named "${stem}" on this server (looked in /esphome)`
    );
  }
  const secrets = loadSecretsMerged();
  const settings = requireFlashSettings(secrets);
  const topicPrefix = await topicPrefixForStem(stem);
  const yaml = buildFlashReadyYaml(found.text, {
    ...settings,
    topicPrefix,
  });
  const safe = stem.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return {
    yaml,
    filename: `${safe}-install.yaml`,
    brokerIp: settings.brokerIp,
    topicPrefix,
  };
}

/** Zip of all device YAMLs with this server’s settings inlined. */
export async function createFlashReadyPack(): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  if (!isDirectory(esphomeDir())) {
    throw new Error("ESPHome folder is not mounted on the API");
  }
  const secrets = loadSecretsMerged();
  const settings = requireFlashSettings(secrets);
  const zip = new JSZip();
  let n = 0;

  for (const { rel, data } of listEsphomeFiles()) {
    if (!/\.ya?ml$/i.test(rel)) continue;
    const base = path.basename(rel, path.extname(rel)).toLowerCase();
    if (base === "secrets") {
      // Also include an updated secrets.yaml for server-side ESPHome (optional)
      const updated = rewriteEsphomeSecretsYaml(data.toString("utf8"), {
        brokerIp: settings.brokerIp,
        mqttUsername: settings.mqttUsername,
        mqttPassword: settings.mqttPassword,
        wifiSsid: settings.wifiSsid,
        wifiPassword: settings.wifiPassword,
      });
      zip.file("secrets.yaml", updated);
      continue;
    }
    const stem = path.basename(rel, path.extname(rel));
    const topicPrefix = await topicPrefixForStem(stem);
    const yaml = buildFlashReadyYaml(data.toString("utf8"), {
      ...settings,
      topicPrefix,
    });
    zip.file(`flash-ready/${stem}-flash-ready.yaml`, yaml);
    n += 1;
  }

  if (n === 0) {
    throw new Error("No device YAML files in /esphome — run Adopt or add YAML first");
  }

  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );
  const day = new Date().toISOString().slice(0, 10);
  return { buffer, filename: `esphome-flash-ready-${day}.zip` };
}
