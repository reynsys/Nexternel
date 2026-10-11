import type { EsphomeDeviceBuilderConfig } from "@nexternel/domain";
import {
  extractTopLevelSection,
  resolveSubstitutions,
  splitYamlListItems,
} from "../yaml.js";
import { generateEsphomeYaml } from "./generate.js";
import { inferBuilderConfigFromYaml } from "./parse-config.js";

/** Sections a foreign file may keep. Anything else means hardware Nexternel does not represent yet. */
const SHELL_KEYS = new Set([
  "substitutions",
  "esphome",
  "esp32",
  "esp8266",
  "logger",
  "api",
  "ota",
  "wifi",
  "captive_portal",
  "mqtt",
  "sensor",
  "switch",
  "packages",
  "web_server",
  "mdns",
  "status_led",
  "debug",
  "preferences",
  "uart",
  "time",
]);

const SENSOR_PLATFORMS = new Set(["dht", "pmsx003", "pulse_meter"]);
const SWITCH_PLATFORMS = new Set(["gpio", "output", "inverted_gpio"]);

function topLevelKeys(yaml: string): string[] {
  return yaml
    .split(/\r?\n/)
    .filter((line) => /^[a-zA-Z_][\w-]*:/.test(line))
    .map((line) => line.split(":")[0]);
}

function platforms(section: string | null): string[] {
  if (!section) return [];
  return splitYamlListItems(section)
    .map((block) => /\bplatform:\s*([\w_]+)/i.exec(block)?.[1]?.toLowerCase())
    .filter((platform): platform is string => Boolean(platform));
}

export function extractOtaPassword(yaml: string): string | undefined {
  const ota = extractTopLevelSection(resolveSubstitutions(yaml), "ota");
  if (!ota) return undefined;
  const match = /^\s*password:\s*(?:"([^"]*)"|'([^']*)'|(\S+))\s*$/m.exec(ota);
  const value = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  return value || undefined;
}

function deviceNameFromYaml(yaml: string, fallback: string): string {
  const resolved = resolveSubstitutions(yaml);
  const match =
    /^esphome:\s*\n(?:[ \t].*\n)*?[ \t]*name:\s*["']?([^"'\n#]+)["']?/m.exec(resolved);
  const name = match?.[1]?.trim();
  return name || fallback;
}

/**
 * Build the Nexternel firmware file from a device that came from another system.
 * The sensor and where it is wired stay. An update password the board already
 * uses stays, so the replacement can still be installed wirelessly.
 * Returns null when the file contains hardware this builder cannot represent.
 */
export function nexternelFirmwareFromLegacyYaml(
  yaml: string,
  slug: string,
  displayName: string
): { yaml: string; config: EsphomeDeviceBuilderConfig } | null {
  const resolved = resolveSubstitutions(yaml);
  const keys = topLevelKeys(resolved);
  if (keys.some((key) => !SHELL_KEYS.has(key))) return null;

  const sensorPlatforms = platforms(extractTopLevelSection(resolved, "sensor"));
  if (sensorPlatforms.some((platform) => !SENSOR_PLATFORMS.has(platform))) return null;

  const switchPlatforms = platforms(extractTopLevelSection(resolved, "switch"));
  if (switchPlatforms.some((platform) => !SWITCH_PLATFORMS.has(platform))) return null;

  if (keys.includes("uart") && !sensorPlatforms.includes("pmsx003")) return null;
  if (keys.includes("time") && !sensorPlatforms.includes("pulse_meter")) return null;

  const deviceSlug = deviceNameFromYaml(yaml, slug);
  const config = inferBuilderConfigFromYaml(yaml, deviceSlug, displayName);
  if (!config) return null;

  return {
    config,
    yaml: generateEsphomeYaml(config, { otaPassword: extractOtaPassword(yaml) }),
  };
}

/** Keep a sensor type only when the original file named one. */
export function preserveSpecifiedSensorTypes(
  normalized: EsphomeDeviceBuilderConfig,
  source: EsphomeDeviceBuilderConfig
): EsphomeDeviceBuilderConfig {
  return {
    ...normalized,
    components: normalized.components.map((component, index) => {
      const original = source.components[index];
      if (component.kind !== "dht" || original?.variant) return component;
      const next = { ...component };
      delete next.variant;
      return next;
    }),
  };
}
