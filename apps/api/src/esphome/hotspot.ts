import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { esphomeDir, pathExists } from "../migrate/paths.js";
import { readDeviceEsphomeYaml } from "./builder/firmware.js";

/**
 * The emergency Wi-Fi hotspot every Nexternel board opens when it cannot reach the home Wi-Fi for a
 * minute (shared board settings, esphome/packages/nexternel-device.yaml): named after the board, with
 * one password for all boards, kept in esphome/secrets.yaml as SECRET. Connecting to it shows the
 * board's own page to choose the Wi-Fi again. A board whose own file sets a hotspot keeps that one.
 */
export const SECRET = "nexternel_ap_password";

/** Add the hotspot password to secrets.yaml when it is missing (at start-up; never changes it). */
export function ensureHotspotPassword(dir = esphomeDir()): boolean {
  const file = path.join(dir, "secrets.yaml");
  if (!pathExists(file)) return false;
  const text = fs.readFileSync(file, "utf8");
  if (new RegExp(`^${SECRET}:`, "m").test(text)) return false;
  // Letters and digits only (ESPHome wants at least 8 characters), without look-alikes such as 0/O, 1/l.
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const password = Array.from(randomBytes(12), (b) => letters[b % letters.length]).join("");
  const line = `# Emergency Wi-Fi hotspot of every Nexternel board (Devices → a board → Advanced shows it)\n${SECRET}: "${password}"\n`;
  fs.writeFileSync(file, text.endsWith("\n") || !text ? text + line : `${text}\n${line}`);
  return true;
}

export function hotspotPassword(dir = esphomeDir()): string | null {
  const file = path.join(dir, "secrets.yaml");
  if (!pathExists(file)) return null;
  const m = new RegExp(`^${SECRET}:\\s*"?([^"\\n]+?)"?\\s*$`, "m").exec(fs.readFileSync(file, "utf8"));
  return m?.[1] ?? null;
}

export type Hotspot =
  /** The shared hotspot: the board's ESPHome name and the shared password. */
  | { own: false; name: string; password: string | null }
  /** Set in the board's own file (its name when the file gives it plainly). */
  | { own: true; name: string | null };

/** Does this settings file set its own hotspot (an `ap:` under `wifi:`)? Its name, when given. */
export function ownHotspot(yaml: string): { name: string | null } | null {
  const wifi = /^wifi:\s*\n((?:[ \t]+.*\n?|\s*\n)*)/m.exec(yaml)?.[1] ?? "";
  if (!/^[ \t]+ap:/m.test(wifi)) return null;
  const ssid = /^[ \t]+ap:\s*\n[ \t]+ssid:\s*"?([^"\n]+?)"?\s*$/m.exec(wifi)?.[1] ?? null;
  // "${ap_ssid}": look the name up in the file's substitutions.
  const sub = ssid && /^\$\{(\w+)\}$/.exec(ssid)?.[1];
  if (sub) return { name: new RegExp(`^[ \\t]+${sub}:\\s*"?([^"\\n]+?)"?\\s*$`, "m").exec(yaml)?.[1] ?? null };
  return { name: ssid };
}

export async function deviceHotspot(deviceId: string, esphomeName: string): Promise<Hotspot> {
  const file = await readDeviceEsphomeYaml(deviceId).catch(() => null);
  const own = file ? ownHotspot(file.yaml) : null;
  if (own) return { own: true, name: own.name };
  return { own: false, name: esphomeName, password: hotspotPassword() };
}
