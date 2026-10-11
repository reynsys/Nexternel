import { access, readFile, readdir, unlink } from "fs/promises";
import { join } from "path";

export interface EsphomeImportSuggestion {
  esphomeName: string;
  mqttTopicPrefix: string;
  yamlFile: string;
  sensors: {
    name: string;
    slug: string;
    sensorType: string;
    unit?: string;
    esphomeEntityId: string;
  }[];
  relays: {
    name: string;
    slug: string;
    esphomeEntityId: string;
    gpioPin?: number;
  }[];
}

const ESPHOME_DIRS = ["/esphome", join(process.cwd(), "..", "..", "esphome")];

const SKIP_YAML = new Set(["secrets", "packages"]);

/** ESPHome node name on device → YAML file stem in esphome/ (OTA name may differ from file name). */
const YAML_NAME_ALIASES: Record<string, string> = {
  "home-assistant-glow": "glow-energy",
};

/**
 * Identifier for generated YAML `id:` fields (C++ names: no hyphens) — lowercase,
 * spaces and hyphens → underscores. Not the MQTT topic name; see esphomeMqttObjectId.
 */
export function esphomeObjectIdFromName(name: string): string {
  return name.trim().toLowerCase().replace(/[ -]+/g, "_");
}

/**
 * The object id ESPHome itself uses in MQTT topics: lowercase, each space → `_`, then any
 * character other than a–z, 0–9, `_` or `-` → `_` (ESPHome's snake_case + sanitize).
 * "House - Daily Energy" → "house_-_daily_energy" — the name its readings are stored under.
 */
export function esphomeMqttObjectId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^a-z0-9_-]/g, "_");
}

/** Entity id prefix from device slug — slug may use hyphens; ESPHome ids must not. */
export function esphomeEntityIdPrefix(slug: string): string {
  return slug.replace(/-/g, "_");
}

/** Inline `substitutions:` values into `${key}` placeholders (best-effort). */
export function resolveSubstitutions(yaml: string): string {
  const subs: Record<string, string> = {};
  const subSection = extractTopLevelSection(yaml, "substitutions");
  if (!subSection) return yaml;

  for (const line of subSection.split(/\r?\n/)) {
    const m = /^\s*(\w+):\s*["']?([^"'\n#]+?)["']?\s*$/.exec(line);
    if (m) subs[m[1]] = m[2].trim();
  }

  let resolved = yaml;
  for (const [key, value] of Object.entries(subs)) {
    resolved = resolved.replaceAll(`\${${key}}`, value);
  }
  return resolved;
}

/** Top-level YAML section body (lines after `key:` until next top-level key). */
export function extractTopLevelSection(yaml: string, key: string): string | null {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*$`).test(line));
  if (start === -1) return null;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[a-zA-Z_][\w-]*:\s*/.test(line)) break;
    body.push(line);
  }
  return body.join("\n");
}

/** Split a YAML list section into one string per `-` list item. */
export function splitYamlListItems(section: string): string[] {
  const items: string[] = [];
  let current: string[] = [];

  for (const line of section.split(/\r?\n/)) {
    if (/^\s*-\s+/.test(line)) {
      if (current.length) items.push(current.join("\n"));
      current = [line.replace(/^\s*-\s+/, "")];
    } else if (current.length && (line.trim() === "" || /^\s+/.test(line))) {
      current.push(line);
    }
  }
  if (current.length) items.push(current.join("\n"));
  return items;
}

function parsePin(block: string): number | undefined {
  const inline = /\bpin:\s*GPIO?(\d+)/i.exec(block);
  if (inline) return Number(inline[1]);
  const nested = /\bnumber:\s*GPIO?(\d+)/i.exec(block);
  if (nested) return Number(nested[1]);
  return undefined;
}

function parseYamlName(block: string): string | undefined {
  const doubleQuoted = /\bname:\s*"([^"]+)"/i.exec(block);
  if (doubleQuoted) return doubleQuoted[1].trim();
  const singleQuoted = /\bname:\s*'([^']+)'/i.exec(block);
  if (singleQuoted) return singleQuoted[1].trim();
  const plain = /\bname:\s*([^\n#]+)/i.exec(block);
  if (plain) return plain[1].trim();
  return undefined;
}

function parseSwitchBlock(block: string): {
  entityId: string;
  name: string;
  gpioPin?: number;
} | null {
  if (!/platform:\s*(gpio|output|inverted_gpio)/i.test(block)) return null;
  if (/\binternal:\s*true/i.test(block)) return null;

  const idM = /\bid:\s*(\w+)/i.exec(block);
  const objectIdM = /\bobject_id:\s*(\w+)/i.exec(block);
  const label = parseYamlName(block);
  const outputRef = /\boutput:\s*(\w+)/i.exec(block)?.[1];

  let entityId = objectIdM?.[1] || idM?.[1];

  if (!entityId && label) {
    entityId = esphomeMqttObjectId(label);
  }
  if (!entityId && outputRef) {
    entityId = outputRef;
  }
  if (!entityId) return null;

  const idLower = entityId.toLowerCase();
  if (idLower.startsWith("output_") || idLower.startsWith("led_")) return null;
  const labelLower = (label || "").toLowerCase();
  if (/^output\s/.test(labelLower) || labelLower === "red" || labelLower === "green") {
    return null;
  }

  return {
    entityId,
    name: label || entityId.replace(/_/g, " "),
    gpioPin: parsePin(block),
  };
}

function parseSwitchRelays(yaml: string): EsphomeImportSuggestion["relays"] {
  const relays: EsphomeImportSuggestion["relays"] = [];
  const seen = new Set<string>();

  function addRelay(parsed: { entityId: string; name: string; gpioPin?: number }) {
    if (seen.has(parsed.entityId)) return;
    seen.add(parsed.entityId);
    relays.push({
      name: parsed.name,
      slug: parsed.entityId.replace(/_/g, "-"),
      esphomeEntityId: parsed.entityId,
      gpioPin: parsed.gpioPin,
    });
  }

  const switchSection = extractTopLevelSection(yaml, "switch");
  if (switchSection) {
    for (const block of splitYamlListItems(switchSection)) {
      const parsed = parseSwitchBlock(block);
      if (parsed) addRelay(parsed);
    }
  }

  return relays;
}

function parseYamlObjectId(block: string): string | undefined {
  const m = /\bobject_id:\s*(\w+)/i.exec(block);
  return m?.[1];
}

/** MQTT topic segment: object_id → slugified name → internal id. */
function resolveSensorEntityId(block: string, fallback?: string): string | undefined {
  const objectId = parseYamlObjectId(block);
  if (objectId) return objectId;
  const name = parseYamlName(block);
  if (name) return esphomeMqttObjectId(name);
  const id = parseYamlId(block);
  if (id) return id;
  return fallback;
}

function parseYamlId(block: string): string | undefined {
  const idM = /\bid:\s*(\w+)/i.exec(block);
  return idM?.[1];
}

function parseUnit(block: string): string | undefined {
  const m = /\bunit_of_measurement:\s*['"]?([^'"\n#]+?)['"]?\s*$/im.exec(block);
  return m?.[1]?.trim();
}

function parseDeviceClass(block: string): string | undefined {
  const m = /\bdevice_class:\s*(\w+)/i.exec(block);
  return m?.[1]?.toLowerCase();
}

/** Body of a nested YAML key inside a list item (e.g. `temperature:` under `dht`). */
function extractNestedSubBlock(block: string, key: string): string | null {
  const lines = block.split(/\r?\n/);
  const keyRe = new RegExp(`^\\s*${key}:\\s*(.*)$`);
  let start = -1;
  let baseIndent = 0;
  let inlineTail: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const m = keyRe.exec(lines[i]);
    if (!m) continue;
    start = i;
    baseIndent = (lines[i].match(/^\s*/) ?? [""])[0].length;
    const inline = m[1]?.trim();
    inlineTail = inline && inline.length > 0 ? inline : null;
    break;
  }
  if (start === -1) return null;

  if (inlineTail) return inlineTail;

  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      body.push(line);
      continue;
    }
    const indent = (line.match(/^\s*/) ?? [""])[0].length;
    if (indent <= baseIndent) break;
    body.push(line);
  }
  return body.length ? body.join("\n") : null;
}

type NestedSensorDef = {
  subKey: string;
  sensorType: string;
  defaultUnit?: string;
};

/** ESPHome platforms with nested sensor entities (not a single top-level name/id). */
const NESTED_SENSOR_PLATFORMS: Record<string, NestedSensorDef[]> = {
  dht: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  dht12: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  dht22: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  sht3x: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  sht4x: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  scd4x: [
    { subKey: "co2", sensorType: "co2", defaultUnit: "ppm" },
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  shtcx: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  aht10: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  htu21d: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  htu31d: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
  ],
  bme280: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
    { subKey: "pressure", sensorType: "pressure", defaultUnit: "hPa" },
  ],
  bme680: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "humidity", sensorType: "humidity", defaultUnit: "%" },
    { subKey: "pressure", sensorType: "pressure", defaultUnit: "hPa" },
  ],
  bmp280: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "pressure", sensorType: "pressure", defaultUnit: "hPa" },
  ],
  bmp085: [
    { subKey: "temperature", sensorType: "temperature", defaultUnit: "°C" },
    { subKey: "pressure", sensorType: "pressure", defaultUnit: "hPa" },
  ],
  pmsx003: [
    { subKey: "pm_1_0", sensorType: "pm1", defaultUnit: "µg/m³" },
    { subKey: "pm_2_5", sensorType: "pm25", defaultUnit: "µg/m³" },
    { subKey: "pm_10_0", sensorType: "pm10", defaultUnit: "µg/m³" },
  ],
  pmsa003: [
    { subKey: "pm_1_0", sensorType: "pm1", defaultUnit: "µg/m³" },
    { subKey: "pm_2_5", sensorType: "pm25", defaultUnit: "µg/m³" },
    { subKey: "pm_10_0", sensorType: "pm10", defaultUnit: "µg/m³" },
  ],
  pmsa003i: [
    { subKey: "pm_1_0", sensorType: "pm1", defaultUnit: "µg/m³" },
    { subKey: "pm_2_5", sensorType: "pm25", defaultUnit: "µg/m³" },
    { subKey: "pm_10_0", sensorType: "pm10", defaultUnit: "µg/m³" },
  ],
  pmsx003i: [
    { subKey: "pm_1_0", sensorType: "pm1", defaultUnit: "µg/m³" },
    { subKey: "pm_2_5", sensorType: "pm25", defaultUnit: "µg/m³" },
    { subKey: "pm_10_0", sensorType: "pm10", defaultUnit: "µg/m³" },
  ],
};

function parseNestedPlatformSensors(
  block: string,
  platform: string,
  addSensor: (opts: {
    entityId: string;
    name: string;
    sensorType: string;
    unit?: string;
  }) => void
): boolean {
  const defs = NESTED_SENSOR_PLATFORMS[platform];
  if (!defs) return false;

  let added = false;
  for (const def of defs) {
    const sub = extractNestedSubBlock(block, def.subKey);
    if (!sub) continue;

    const entityId =
      resolveSensorEntityId(sub, `${platform}_${def.subKey}`) ??
      `${platform}_${def.subKey}`;
    const name = parseYamlName(sub) ?? def.subKey.replace(/_/g, " ");
    const unit = parseUnit(sub) ?? def.defaultUnit;
    let sensorType = def.sensorType;
    if (entityId.includes("temperature")) sensorType = "temperature";
    else if (entityId.includes("humidity")) sensorType = "humidity";
    else if (entityId.includes("pressure")) sensorType = "pressure";
    else if (entityId.includes("pm_10") || entityId.includes("pm10")) sensorType = "pm10";
    else if (entityId.includes("pm_2") || entityId.includes("pm25")) sensorType = "pm25";
    else if (entityId.includes("pm_1") || entityId.includes("pm1")) sensorType = "pm1";

    addSensor({ entityId, name, sensorType, unit });
    added = true;
  }
  return added;
}

function parseSensorBlocks(yaml: string): EsphomeImportSuggestion["sensors"] {
  const sensors: EsphomeImportSuggestion["sensors"] = [];
  const seen = new Set<string>();

  function addSensor(opts: {
    entityId: string;
    name: string;
    sensorType: string;
    unit?: string;
  }) {
    if (seen.has(opts.entityId)) return;
    seen.add(opts.entityId);
    sensors.push({
      name: opts.name,
      slug: opts.entityId.replace(/_/g, "-"),
      sensorType: opts.sensorType,
      unit: opts.unit,
      esphomeEntityId: opts.entityId,
    });
  }

  const sensorSection = extractTopLevelSection(yaml, "sensor");
  if (!sensorSection) return sensors;

  for (const block of splitYamlListItems(sensorSection)) {
    const platform = /\bplatform:\s*([\w_]+)/i.exec(block)?.[1]?.toLowerCase();
    if (!platform) continue;

    if (platform === "pulse_meter") {
      const entityId = resolveSensorEntityId(block, "sensor_energy_pulse_meter");
      if (!entityId) continue;
      addSensor({
        entityId,
        name: parseYamlName(block) ?? "Power consumption",
        sensorType: "power",
        unit: parseUnit(block) ?? "W",
      });
      const totalMatch = /\btotal:\s*\n([\s\S]*)/i.exec(block);
      if (totalMatch) {
        const totalBlock = totalMatch[1];
        const totalId = resolveSensorEntityId(totalBlock, "sensor_total_energy");
        if (totalId) {
          addSensor({
            entityId: totalId,
            name: parseYamlName(totalBlock) ?? "Total energy",
            sensorType: "energy",
            unit: parseUnit(totalBlock) ?? "kWh",
          });
        }
      }
      continue;
    }

    if (platform === "total_daily_energy") {
      const entityId = resolveSensorEntityId(block, "sensor_total_daily_energy");
      if (!entityId) continue;
      addSensor({
        entityId,
        name: parseYamlName(block) ?? "Daily energy",
        sensorType: "energy",
        unit: parseUnit(block) ?? "kWh",
      });
      continue;
    }

    if (platform === "wifi_signal") {
      continue;
    }

    if (NESTED_SENSOR_PLATFORMS[platform]) {
      parseNestedPlatformSensors(block, platform, (opts) => addSensor(opts));
      continue;
    }

    const entityId = resolveSensorEntityId(block);
    if (!entityId) continue;

    const deviceClass = parseDeviceClass(block);
    let sensorType = deviceClass ?? "number";
    if (entityId.includes("temperature")) sensorType = "temperature";
    else if (entityId.includes("humidity")) sensorType = "humidity";
    else if (entityId.includes("pressure")) sensorType = "pressure";
    else if (entityId.includes("battery")) sensorType = "battery";

    addSensor({
      entityId,
      name: parseYamlName(block) ?? entityId.replace(/_/g, " "),
      sensorType,
      unit: parseUnit(block),
    });
  }

  return sensors;
}

/** Best-effort parse of ESPHome YAML for device registration hints. */
export function parseEsphomeYaml(
  yaml: string,
  fallbackName: string,
  yamlFile = fallbackName
): EsphomeImportSuggestion {
  const resolved = resolveSubstitutions(yaml);

  const nameMatch =
    /(?:^|\n)\s*name:\s*["']?([^"'\n${}]+?)["']?\s*$/m.exec(resolved) ||
    /^esphome:\s*\n(?:\s+.+\n)*?\s+name:\s*["']?([^"'\n${}]+)/m.exec(resolved);
  const esphomeName = nameMatch?.[1]?.trim() || fallbackName;

  const prefixMatch = /topic_prefix:\s*["']?([^"'\n${}]+)/m.exec(resolved);
  const mqttTopicPrefix = prefixMatch?.[1]?.trim() || `nexternel/${esphomeName}`;

  const sensors = parseSensorBlocks(resolved);

  // Legacy fallback: id blocks for simple DHT-style YAML without full sensor sections
  if (sensors.length === 0) {
    const idBlocks = [...resolved.matchAll(/\s+id:\s*(\w+)\s*\n/g)];
    for (const [, id] of idBlocks) {
      if (id.includes("temperature")) {
        sensors.push({
          name: "Temperature",
          slug: "temperature",
          sensorType: "temperature",
          unit: "°C",
          esphomeEntityId: id,
        });
      } else if (id.includes("humidity")) {
        sensors.push({
          name: "Humidity",
          slug: "humidity",
          sensorType: "humidity",
          unit: "%",
          esphomeEntityId: id,
        });
      }
    }
  }

  const relays = parseSwitchRelays(resolved);

  return { esphomeName, mqttTopicPrefix, yamlFile, sensors, relays };
}

export type EsphomeYamlFileEntry = {
  /** File stem (no path, no extension) — ESPHome node name when set in YAML. */
  stem: string;
  /** Path under esphome/, e.g. `living-room.yaml` or `devices/test.yaml`. */
  relativePath: string;
};

/** List YAML files on the server ESPHome config folder (not the ESPHome dashboard). */
export async function listEsphomeYamlFileEntries(): Promise<EsphomeYamlFileEntry[]> {
  const entries: EsphomeYamlFileEntry[] = [];
  const seenPaths = new Set<string>();

  for (const dir of ESPHOME_DIRS) {
    for (const sub of ["", "devices"]) {
      try {
        const scanDir = sub ? join(dir, sub) : dir;
        const files = await readdir(scanDir);
        for (const file of files) {
          if (!file.endsWith(".yaml")) continue;
          const stem = file.replace(/\.yaml$/, "");
          if (SKIP_YAML.has(stem)) continue;
          const relativePath = (sub ? `${sub}/${file}` : file).replace(/\\/g, "/");
          if (seenPaths.has(relativePath)) continue;
          try {
            await access(join(scanDir, file));
          } catch {
            continue;
          }
          seenPaths.add(relativePath);
          entries.push({ stem, relativePath });
        }
      } catch {
        /* try next path */
      }
    }
  }

  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function listEsphomeYamlFiles(): Promise<string[]> {
  const stems = new Set<string>();
  for (const entry of await listEsphomeYamlFileEntries()) {
    stems.add(entry.stem);
  }
  return Array.from(stems).sort((a, b) => a.localeCompare(b));
}

/** Delete an unregistered YAML file from the server esphome/ folder. */
export async function deleteEsphomeYamlByRelativePath(relativePath: string): Promise<boolean> {
  const clean = relativePath.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!clean || clean.includes("..") || /^secrets\.yaml$/i.test(clean)) {
    return false;
  }
  const fileName = clean.endsWith(".yaml") ? clean : `${clean}.yaml`;

  for (const dir of ESPHOME_DIRS) {
    try {
      await unlink(join(dir, fileName));
      return true;
    } catch {
      /* try next path */
    }
  }
  return false;
}

export async function loadEsphomeYaml(esphomeName: string): Promise<string | null> {
  const candidates = [
    esphomeName,
    YAML_NAME_ALIASES[esphomeName],
    esphomeName.replace(/_/g, "-"),
    esphomeName.replace(/-/g, "_"),
  ].filter((c): c is string => Boolean(c));

  for (const base of candidates) {
    const fileName = `${base}.yaml`;
    for (const dir of ESPHOME_DIRS) {
      for (const sub of ["", "devices"]) {
        try {
          return await readFile(join(dir, sub, fileName), "utf8");
        } catch {
          /* try next path */
        }
      }
    }
  }
  return null;
}

async function readEsphomeRelativePath(relPath: string): Promise<string | null> {
  const fileName = relPath.endsWith(".yaml") ? relPath : `${relPath}.yaml`;
  for (const dir of ESPHOME_DIRS) {
    try {
      return await readFile(join(dir, fileName), "utf8");
    } catch {
      /* try next path */
    }
  }
  return null;
}

/** Load YAML and append any `!include` fragments (one level, deduped by content). */
export async function loadEsphomeYamlMerged(esphomeName: string): Promise<string | null> {
  const base = await loadEsphomeYaml(esphomeName);
  if (!base) return null;

  const mergedParts = [base];
  const seenPaths = new Set<string>();
  const queue = [...base.matchAll(/!include\s+['"]?([^'"\s#]+)['"]?/g)].map((m) => m[1]);

  while (queue.length > 0) {
    const relPath = queue.shift()!;
    const normalized = relPath.replace(/\.yaml$/, "");
    if (seenPaths.has(normalized)) continue;
    seenPaths.add(normalized);

    const inc =
      (await readEsphomeRelativePath(relPath)) ??
      (await loadEsphomeYaml(normalized));
    if (!inc || mergedParts.some((part) => part.includes(inc))) continue;

    mergedParts.push(inc);
    for (const nested of inc.matchAll(/!include\s+['"]?([^'"\s#]+)['"]?/g)) {
      queue.push(nested[1]);
    }
  }

  return mergedParts.join("\n");
}

export async function suggestFromEsphome(
  esphomeName: string
): Promise<EsphomeImportSuggestion | null> {
  const yaml = await loadEsphomeYamlMerged(esphomeName);
  if (!yaml) return null;
  return parseEsphomeYaml(yaml, esphomeName, esphomeName);
}

/** Try several file/name variants until YAML loads. */
export async function suggestFromEsphomeCandidates(
  names: string[]
): Promise<EsphomeImportSuggestion | null> {
  const tried = new Set<string>();
  for (const raw of names) {
    if (!raw || tried.has(raw)) continue;
    tried.add(raw);
    const yaml = await loadEsphomeYamlMerged(raw);
    if (!yaml) continue;
    return parseEsphomeYaml(yaml, raw, raw);
  }
  return null;
}
