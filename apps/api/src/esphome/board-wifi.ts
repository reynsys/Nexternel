/**
 * "Wi-Fi for your devices": the home Wi-Fi name and password that Nexternel's boards join.
 * Kept where ESPHome reads it (esphome/secrets.yaml: wifi_ssid / wifi_password), set on screen
 * (setup wizard, Settings → System, or when adding a board) — never by editing the file.
 */
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { esphomeDir, pathExists } from "../migrate/paths.js";

const PLACEHOLDERS = [/^YOUR_WIFI_SSID$/i, /^YOUR_WIFI_PASSWORD$/i, /^change_me/i, /^your_wifi/i, /^example$/i];

export function isPlaceholderWifiValue(value: string): boolean {
  const v = value.trim();
  return Boolean(v) && PLACEHOLDERS.some((p) => p.test(v));
}

function secretsFile(dir: string): string {
  return path.join(dir, "secrets.yaml");
}

/** One top-level value from the file: double-quoted (JSON-style), single-quoted or plain. */
export function readSecretValue(text: string, key: string): string | null {
  const m = new RegExp(`^${key}\\s*:\\s*(.*?)\\s*$`, "m").exec(text);
  if (!m) return null;
  const raw = m[1];
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw.replace(/\s+#.*$/, "");
}

/** Set one top-level value, always double-quoted (so "12345678" or "yes" stay text). */
export function writeSecretValue(text: string, key: string, value: string): string {
  const line = `${key}: ${JSON.stringify(value)}`;
  const re = new RegExp(`^${key}\\s*:.*$`, "m");
  if (re.test(text)) return text.replace(re, () => line);
  return `${text.replace(/\s*$/, "")}${text.trim() ? "\n" : ""}${line}\n`;
}

/**
 * A new home has no secrets file: create it (message service login, no Wi-Fi yet), so boards can
 * be made once the owner sets the Wi-Fi on screen. Runs at every start; never changes an existing file.
 */
export function ensureEsphomeSecretsFile(dir = esphomeDir()): boolean {
  if (pathExists(secretsFile(dir)) || pathExists(path.join(dir, "secrets.yml"))) return false;
  fs.mkdirSync(dir, { recursive: true });
  let text =
    "# Nexternel's settings for boards (made by Nexternel; change them on screen, not here).\n" +
    "# Wi-Fi for your devices: Settings → System.\n";
  text = writeSecretValue(text, "mqtt_broker", config.serverIp() || "");
  text = writeSecretValue(text, "mqtt_username", config.mqttUsername());
  text = writeSecretValue(text, "mqtt_password", config.mqttPassword());
  fs.writeFileSync(secretsFile(dir), text, { mode: 0o600 });
  return true;
}

export type BoardWifi = { ssid: string | null; passwordSet: boolean };

export function readBoardWifi(dir = esphomeDir()): BoardWifi {
  const file = pathExists(secretsFile(dir)) ? secretsFile(dir) : path.join(dir, "secrets.yml");
  if (!pathExists(file)) return { ssid: null, passwordSet: false };
  const text = fs.readFileSync(file, "utf8");
  const ssid = readSecretValue(text, "wifi_ssid")?.trim() || null;
  const password = readSecretValue(text, "wifi_password") ?? "";
  return {
    ssid: ssid && !isPlaceholderWifiValue(ssid) ? ssid : null,
    passwordSet: password !== "" && !isPlaceholderWifiValue(password),
  };
}

export class BoardWifiInvalid extends Error {}

/**
 * Save the Wi-Fi for boards. An empty password keeps the one already saved (changing only the name
 * is allowed when a password is set). Boards keep the Wi-Fi they have until their next install.
 */
/** What is wrong with this Wi-Fi name and password, in plain words; null when they can be saved. */
export function boardWifiProblem(input: { ssid: string; password: string }, passwordAlreadySet: boolean): string | null {
  const ssid = input.ssid.trim();
  if (!ssid) return "Type the name of your home Wi-Fi.";
  if (Buffer.byteLength(ssid, "utf8") > 32) return "A Wi-Fi name has at most 32 letters.";
  if (!input.password && !passwordAlreadySet) return "Type your Wi-Fi password.";
  if (input.password && (input.password.length < 8 || input.password.length > 63)) {
    return "A Wi-Fi password has 8 to 63 characters.";
  }
  return null;
}

export function writeBoardWifi(input: { ssid: string; password: string }, dir = esphomeDir()): BoardWifi {
  const problem = boardWifiProblem(input, readBoardWifi(dir).passwordSet);
  if (problem) throw new BoardWifiInvalid(problem);
  const ssid = input.ssid.trim();
  ensureEsphomeSecretsFile(dir);
  const file = pathExists(secretsFile(dir)) ? secretsFile(dir) : path.join(dir, "secrets.yml");
  let text = fs.readFileSync(file, "utf8");
  text = writeSecretValue(text, "wifi_ssid", ssid);
  if (input.password) text = writeSecretValue(text, "wifi_password", input.password);
  const tmp = `${file}.new-${process.pid}`;
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return readBoardWifi(dir);
}
