/**
 * Nexternel-managed ESPHome device builder — shared contracts.
 * Component catalogue: esphome-builder-catalog.ts (add hardware there).
 */

export const ESPHOME_BUILDER_CONFIG_VERSION = 1 as const;

export type {
  BuilderComponent,
  BuilderComponentCatalogEntry,
  BuilderComponentGroup,
  BuilderConnectionType,
  BuilderFieldDef,
  BuilderFieldType,
  BuilderGeneratorProfile,
  EsphomeBoardId,
  EsphomePlatform,
} from "./esphome-builder-types.js";

export {
  ESPHOME_COMPONENT_CATALOG,
  type BuilderComponentKind,
} from "./esphome-builder-catalog.js";

import {
  ESPHOME_COMPONENT_CATALOG,
  type BuilderComponentKind,
} from "./esphome-builder-catalog.js";
import type {
  BuilderComponent,
  BuilderComponentGroup,
  BuilderConnectionType,
  BuilderComponentCatalogEntry,
  EsphomeBoardId,
  EsphomePlatform,
} from "./esphome-builder-types.js";

/** How Nexternel relates to the ESPHome configuration for this device. */
export type EsphomeManagementMode = "managed" | "imported" | "advanced";

export type EsphomeLifecycleState =
  | "draft"
  | "configured"
  | "validation_failed"
  | "ready_to_build"
  | "building"
  | "firmware_ready"
  | "awaiting_installation"
  | "connecting"
  | "online"
  | "offline"
  | "error"
  | "configuration_missing";

export type EsphomeDeviceBuilderConfig = {
  version: typeof ESPHOME_BUILDER_CONFIG_VERSION;
  platform: EsphomePlatform;
  boardId: EsphomeBoardId;
  displayName: string;
  slug?: string;
  description?: string;
  roomId?: string | null;
  components: BuilderComponent[];
};

export const BUILDER_COMPONENT_GROUP_ORDER: BuilderComponentGroup[] = [
  "climate",
  "air_quality",
  "light",
  "distance",
  "energy",
  "environment",
  "actuators",
];

export const BUILDER_COMPONENT_GROUP_LABELS: Record<BuilderComponentGroup, string> = {
  climate: "Climate",
  air_quality: "Air quality",
  light: "Light",
  distance: "Distance",
  energy: "Energy",
  environment: "Environment & analog",
  actuators: "Actuators & outputs",
};

export const BUILDER_COMPONENT_GROUP_DESCRIPTIONS: Record<BuilderComponentGroup, string> = {
  climate: "Temperature, humidity, and barometric pressure",
  air_quality: "CO₂, particulates, and VOC sensors",
  light: "Ambient light and illuminance",
  distance: "Ultrasonic and rangefinder sensors",
  energy: "Utility meters and power monitoring",
  environment: "Analog inputs and general environment",
  actuators: "Relays, switches, and GPIO outputs",
};

export const BUILDER_CONNECTION_LABELS: Record<BuilderConnectionType, string> = {
  gpio: "GPIO",
  i2c: "I²C",
  onewire: "One-wire",
  uart: "UART",
  adc: "ADC",
};

export const BUILDER_CONNECTION_ORDER: BuilderConnectionType[] = [
  "gpio",
  "i2c",
  "onewire",
  "uart",
  "adc",
];

export type EsphomeBoardCatalogEntry = {
  id: EsphomeBoardId;
  platform: EsphomePlatform;
  label: string;
  description: string;
  esphomeBoard: string;
  gpioMin: number;
  gpioMax: number;
};

export const ESPHOME_BOARD_CATALOG: EsphomeBoardCatalogEntry[] = [
  {
    id: "esp32dev",
    platform: "esp32",
    label: "ESP32 DevKit",
    description: "Generic ESP32 development board (WROOM/WROVER)",
    esphomeBoard: "esp32dev",
    gpioMin: 0,
    gpioMax: 39,
  },
  {
    id: "esp32-c3-devkitm-1",
    platform: "esp32",
    label: "ESP32-C3 DevKitM-1",
    description: "Espressif ESP32-C3 USB development board",
    esphomeBoard: "esp32-c3-devkitm-1",
    gpioMin: 0,
    gpioMax: 21,
  },
  {
    id: "nodemcuv2",
    platform: "esp8266",
    label: "NodeMCU v2",
    description: "ESP8266 NodeMCU development board",
    esphomeBoard: "nodemcuv2",
    gpioMin: 0,
    gpioMax: 16,
  },
  {
    id: "esp01_1m",
    platform: "esp8266",
    label: "ESP-01 (1 MB)",
    description: "ESP8266 ESP-01 module with 1 MB flash",
    esphomeBoard: "esp01_1m",
    gpioMin: 0,
    gpioMax: 16,
  },
];

export function boardCatalogEntry(
  boardId: EsphomeBoardId
): EsphomeBoardCatalogEntry | undefined {
  return ESPHOME_BOARD_CATALOG.find((b) => b.id === boardId);
}

export function componentCatalogEntry(
  kind: string
): BuilderComponentCatalogEntry | undefined {
  return ESPHOME_COMPONENT_CATALOG.find((c) => c.id === kind);
}

export function builderComponentsForPlatform(
  platform: EsphomePlatform
): BuilderComponentCatalogEntry[] {
  return ESPHOME_COMPONENT_CATALOG.filter((c) => c.platforms.includes(platform));
}

function catalogSearchHaystack(entry: BuilderComponentCatalogEntry): string {
  return [
    entry.label,
    entry.description,
    entry.id,
    entry.group,
    BUILDER_COMPONENT_GROUP_LABELS[entry.group],
    BUILDER_CONNECTION_LABELS[entry.connectionType],
    ...entry.tags,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterBuilderCatalog(opts: {
  platform: EsphomePlatform;
  query?: string;
  group?: BuilderComponentGroup | null;
  connection?: BuilderConnectionType | "all";
}): BuilderComponentCatalogEntry[] {
  let list = builderComponentsForPlatform(opts.platform);
  if (opts.group) {
    list = list.filter((c) => c.group === opts.group);
  }
  if (opts.connection && opts.connection !== "all") {
    list = list.filter((c) => c.connectionType === opts.connection);
  }
  const q = opts.query?.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/).filter(Boolean);
    list = list.filter((entry) => {
      const hay = catalogSearchHaystack(entry);
      return words.every((word) => hay.includes(word));
    });
  }
  return [...list].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
  );
}

export function builderCatalogGroupsForPlatform(platform: EsphomePlatform): {
  group: BuilderComponentGroup;
  label: string;
  description: string;
  count: number;
}[] {
  const list = builderComponentsForPlatform(platform);
  return BUILDER_COMPONENT_GROUP_ORDER
    .map((group) => {
      const count = list.filter((c) => c.group === group).length;
      return {
        group,
        label: BUILDER_COMPONENT_GROUP_LABELS[group],
        description: BUILDER_COMPONENT_GROUP_DESCRIPTIONS[group],
        count,
      };
    })
    .filter((row) => row.count > 0);
}

export function builderCatalogConnectionsInList(
  entries: BuilderComponentCatalogEntry[]
): BuilderConnectionType[] {
  const set = new Set(entries.map((e) => e.connectionType));
  return BUILDER_CONNECTION_ORDER.filter((c) => set.has(c));
}

function nextComponentId(kind: string, existing: BuilderComponent[]): string {
  const count = existing.filter((c) => c.kind === kind).length + 1;
  return `${kind.replace(/[^a-z0-9]/gi, "")}${count}`;
}

export function createDefaultBuilderComponent(
  kind: BuilderComponentKind,
  existing: BuilderComponent[] = []
): BuilderComponent {
  const entry = componentCatalogEntry(kind);
  const id = nextComponentId(kind, existing);
  const comp: BuilderComponent = { id, kind };
  if (!entry) return comp;
  for (const field of entry.fields) {
    if (field.defaultValue !== undefined) {
      (comp as Record<string, unknown>)[field.key] = field.defaultValue;
    }
  }
  return comp;
}

export function builderComponentLabel(kind: string): string {
  return componentCatalogEntry(kind)?.label ?? kind;
}
