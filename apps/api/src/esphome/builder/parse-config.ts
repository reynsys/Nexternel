import {
  ESPHOME_BOARD_CATALOG,
  ESPHOME_BUILDER_CONFIG_VERSION,
  type BuilderComponent,
  type EsphomeBoardId,
  type EsphomeDeviceBuilderConfig,
  type EsphomePlatform,
} from "@nexternel/domain";
import {
  extractTopLevelSection,
  resolveSubstitutions,
  splitYamlListItems,
} from "../yaml.js";

const BUILDER_MARKER = "# Nexternel managed device";

function parsePin(block: string): number | undefined {
  const inline = /\bpin:\s*GPIO?(\d+)/i.exec(block);
  if (inline) return Number(inline[1]);
  const nested = /\bnumber:\s*GPIO?(\d+)/i.exec(block);
  if (nested) return Number(nested[1]);
  return undefined;
}

function parseInterval(block: string): number | undefined {
  const m = /update_interval:\s*(\d+)s/i.exec(block);
  return m ? Number(m[1]) : undefined;
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

function boardIdFromEsphomeBoard(
  platform: EsphomePlatform,
  esphomeBoard: string
): EsphomeBoardId | null {
  const match = ESPHOME_BOARD_CATALOG.find(
    (b) => b.platform === platform && b.esphomeBoard === esphomeBoard
  );
  return match?.id ?? null;
}

function detectPlatform(yaml: string): {
  platform: EsphomePlatform;
  boardId: EsphomeBoardId;
} | null {
  const esp32 = /esp32:\s*\n\s*board:\s*(\S+)/m.exec(yaml);
  if (esp32) {
    const boardId = boardIdFromEsphomeBoard("esp32", esp32[1]);
    if (boardId) return { platform: "esp32", boardId };
  }
  const esp8266 = /esp8266:\s*\n\s*board:\s*(\S+)/m.exec(yaml);
  if (esp8266) {
    const boardId = boardIdFromEsphomeBoard("esp8266", esp8266[1]);
    if (boardId) return { platform: "esp8266", boardId };
  }
  return null;
}

function componentIdFromEntity(entityId: string, slug: string): string {
  const prefix = `${slug}_`;
  if (entityId.startsWith(prefix)) {
    return entityId
      .slice(prefix.length)
      .replace(
        /_temperature$|_humidity$|_pm1$|_pm25$|_pm10$|_power$|_pulse_meter$|_total$|_daily$/,
        ""
      );
  }
  return entityId.replace(/_temperature$|_humidity$/, "");
}

function switchComponentId(entityId: string, slug: string): string {
  if (entityId.startsWith(`${slug}_`)) {
    return entityId.slice(slug.length + 1);
  }
  return entityId;
}

function parseDisplayName(yaml: string, displayNameFallback: string): string {
  return (
    /friendly_name:\s*["']?([^"'\n${}]+)/m.exec(yaml)?.[1]?.trim() ||
    /#\s*Device:\s*(.+)/m.exec(yaml)?.[1]?.trim() ||
    displayNameFallback
  );
}

function parseOutputPinMap(yaml: string): Map<string, number> {
  const map = new Map<string, number>();
  const outputSection = extractTopLevelSection(yaml, "output");
  if (!outputSection) return map;

  for (const block of splitYamlListItems(outputSection)) {
    if (!/platform:\s*gpio/i.test(block)) continue;
    const pin = parsePin(block);
    const idM = /\bid:\s*([\w-]+)/i.exec(block);
    if (pin === undefined || !idM) continue;
    map.set(idM[1], pin);
  }
  return map;
}

function isInternalActuator(block: string, name?: string): boolean {
  if (/\binternal:\s*true/i.test(block)) return true;
  const label = (name || "").toLowerCase();
  if (label === "red" || label === "green" || label === "blue") return true;
  if (/^output\s/.test(label)) return true;
  const idM = /\bid:\s*([\w-]+)/i.exec(block);
  const idLower = idM?.[1]?.toLowerCase() ?? "";
  return idLower.startsWith("output_") || idLower.startsWith("led_");
}

function addGpioSwitch(
  components: BuilderComponent[],
  seen: Set<string>,
  slug: string,
  opts: { entityId: string; name: string; pin: number; inverted?: boolean }
) {
  const compId = switchComponentId(opts.entityId, slug);
  if (seen.has(compId)) return;
  seen.add(compId);
  components.push({
    id: compId,
    kind: "gpio_switch",
    pin: opts.pin,
    name: opts.name,
    inverted: opts.inverted,
  });
}

function parseSwitchComponents(
  yaml: string,
  slug: string,
  components: BuilderComponent[],
  seen: Set<string>,
  outputPins: Map<string, number>
) {
  const switchSection = extractTopLevelSection(yaml, "switch");
  if (!switchSection) return;

  for (const block of splitYamlListItems(switchSection)) {
    const platform = /\bplatform:\s*([\w_]+)/i.exec(block)?.[1]?.toLowerCase();
    if (!platform) continue;

    const name = parseYamlName(block);
    const idM = /\bid:\s*([\w-]+)/i.exec(block);
    if (!name || !idM) continue;
    if (isInternalActuator(block, name)) continue;

    if (platform === "gpio") {
      const pin = parsePin(block);
      if (pin === undefined) continue;
      addGpioSwitch(components, seen, slug, {
        entityId: idM[1],
        name,
        pin,
        inverted: /\binverted:\s*true/i.test(block),
      });
      continue;
    }

    if (platform === "output" || platform === "inverted_gpio") {
      const outputRef = /\boutput:\s*([\w-]+)/i.exec(block)?.[1];
      const pin = outputRef ? outputPins.get(outputRef) : undefined;
      if (pin === undefined) continue;
      addGpioSwitch(components, seen, slug, {
        entityId: idM[1],
        name,
        pin,
        inverted: platform === "inverted_gpio" || /\binverted:\s*true/i.test(block),
      });
    }
  }
}

function parseLightComponents(
  yaml: string,
  slug: string,
  components: BuilderComponent[],
  seen: Set<string>,
  outputPins: Map<string, number>
) {
  const lightSection = extractTopLevelSection(yaml, "light");
  if (!lightSection) return;

  for (const block of splitYamlListItems(lightSection)) {
    const platform = /\bplatform:\s*([\w_]+)/i.exec(block)?.[1]?.toLowerCase();
    if (!platform) continue;

    const name = parseYamlName(block);
    const idM = /\bid:\s*([\w-]+)/i.exec(block);
    if (!name || !idM) continue;
    if (isInternalActuator(block, name)) continue;

    let pin: number | undefined;
    if (platform === "gpio" || platform === "binary") {
      const outputRef = /\boutput:\s*([\w-]+)/i.exec(block)?.[1];
      pin = outputRef ? outputPins.get(outputRef) : parsePin(block);
    }
    if (pin === undefined) continue;

    addGpioSwitch(components, seen, slug, {
      entityId: idM[1],
      name,
      pin,
      inverted: /\binverted:\s*true/i.test(block),
    });
  }
}

function parseComponentsFromYaml(yaml: string, slug: string): BuilderComponent[] {
  const components: BuilderComponent[] = [];
  const seen = new Set<string>();
  const outputPins = parseOutputPinMap(yaml);

  const sensorSection = extractTopLevelSection(yaml, "sensor");
  if (sensorSection) {
    for (const block of splitYamlListItems(sensorSection)) {
      const platform = /\bplatform:\s*([\w_]+)/i.exec(block)?.[1]?.toLowerCase();
      if (!platform) continue;

      if (platform === "dht") {
        const pin = parsePin(block);
        const variant = /\bmodel:\s*(\w+)/i.exec(block)?.[1];
        const idM = /\bid:\s*([\w-]+)_temperature/i.exec(block);
        const compId = idM
          ? componentIdFromEntity(idM[1], slug)
          : `dht${components.filter((c) => c.kind === "dht").length + 1}`;
        if (seen.has(compId) || pin === undefined) continue;
        seen.add(compId);
        components.push({
          id: compId,
          kind: "dht",
          ...(variant ? { variant } : {}),
          pin,
          updateIntervalSeconds: parseInterval(block),
        });
        continue;
      }

      if (platform === "pmsx003") {
        const uartSection = extractTopLevelSection(yaml, "uart");
        let uartBlock = "";
        if (uartSection) {
          const items = splitYamlListItems(uartSection);
          uartBlock = items[0] ?? uartSection;
        }
        const uartId = /\buart_id:\s*uart_(\w+)/i.exec(block)?.[1];
        const tx = uartBlock ? /\btx_pin:\s*GPIO?(\d+)/i.exec(uartBlock)?.[1] : undefined;
        const rx = uartBlock ? /\brx_pin:\s*GPIO?(\d+)/i.exec(uartBlock)?.[1] : undefined;
        const compId = uartId || `pms${components.length + 1}`;
        if (seen.has(compId) || !tx || !rx) continue;
        seen.add(compId);
        const variant = /\btype:\s*(\w+)/i.exec(block)?.[1] as
          | "PMSX003"
          | "PMS5003"
          | "PMS7003"
          | undefined;
        components.push({
          id: compId,
          kind: "pms",
          variant: variant || "PMSX003",
          uartTxPin: Number(tx),
          uartRxPin: Number(rx),
          updateIntervalSeconds: parseInterval(block),
        });
        continue;
      }

      if (platform === "pulse_meter") {
        const pin = parsePin(block);
        const idM = /\bid:\s*([\w-]+)_(?:power|pulse_meter)/i.exec(block);
        const compId = idM
          ? componentIdFromEntity(idM[1], slug)
          : `energy${components.length + 1}`;
        const rateM = /\(60\.0\s*\/\s*(\d+)\)/.exec(block);
        if (seen.has(compId) || pin === undefined) continue;
        seen.add(compId);
        components.push({
          id: compId,
          kind: "pulse_meter",
          pin,
          pulseRate: rateM ? Number(rateM[1]) : 1000,
        });
      }
    }
  }

  parseSwitchComponents(yaml, slug, components, seen, outputPins);
  parseLightComponents(yaml, slug, components, seen, outputPins);

  return components;
}

function buildConfigFromYaml(
  yaml: string,
  slug: string,
  displayNameFallback: string
): EsphomeDeviceBuilderConfig | null {
  const resolved = resolveSubstitutions(yaml);
  const platformInfo = detectPlatform(resolved);
  if (!platformInfo) return null;

  const components = parseComponentsFromYaml(resolved, slug);
  if (components.length === 0) return null;

  return {
    version: ESPHOME_BUILDER_CONFIG_VERSION,
    platform: platformInfo.platform,
    boardId: platformInfo.boardId,
    displayName: parseDisplayName(resolved, displayNameFallback),
    slug,
    components,
  };
}

/**
 * Reverse parse of Device Builder YAML (marker comment required).
 */
export function parseManagedBuilderConfigFromYaml(
  yaml: string,
  slug: string,
  displayNameFallback: string
): EsphomeDeviceBuilderConfig | null {
  if (!yaml.includes(BUILDER_MARKER)) return null;
  return buildConfigFromYaml(yaml, slug, displayNameFallback);
}

/**
 * Best-effort infer builder config from any supported ESPHome YAML (legacy or managed).
 */
export function inferBuilderConfigFromYaml(
  yaml: string,
  slug: string,
  displayNameFallback: string
): EsphomeDeviceBuilderConfig | null {
  return buildConfigFromYaml(yaml, slug, displayNameFallback);
}
