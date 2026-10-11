import type { SystemId } from "@nexternel/domain";
import {
  ESPHOME_BOARD_CATALOG,
  ESPHOME_COMPONENT_CATALOG,
  type EsphomeDeviceBuilderConfig,
  type EsphomeLifecycleState,
  type EsphomeManagementMode,
} from "@nexternel/domain";
import { getPool } from "../../db.js";
import {
  createDevice,
  getDeviceDetailed,
  syncDeviceFromEsphomeSuggestion,
} from "../../devices/service.js";
import { loadEsphomeYaml, loadEsphomeYamlMerged, parseEsphomeYaml, suggestFromEsphome } from "../yaml.js";
import { buildEsphomeDriverManifest } from "../../v4/drivers/esphome.js";
import {
  mapCandidatesToCapabilities,
  syncAndClassifyCapabilities,
} from "../../v4/capability-mapper.js";
import { refreshTelemetrySubscriptions } from "../../telemetry/mqtt.js";
import { installationMqttRoot } from "../../migrate/align-mqtt-topics.js";
import { generateEsphomeYaml } from "./generate.js";
import { inferBuilderConfigFromYaml, parseManagedBuilderConfigFromYaml } from "./parse-config.js";
import {
  nexternelFirmwareFromLegacyYaml,
  preserveSpecifiedSensorTypes,
} from "./replace-firmware.js";
import { writeDeviceYamlFile, writeManagedEsphomeYaml } from "./storage.js";
import {
  normalizeBuilderConfig,
  validateEsphomeBuilderConfig,
  resolveBuilderSlug,
} from "./validate.js";

export function builderCatalogPayload() {
  return {
    boards: ESPHOME_BOARD_CATALOG,
    components: ESPHOME_COMPONENT_CATALOG,
    managementModes: ["managed", "imported", "advanced"] as EsphomeManagementMode[],
    lifecycleStates: [
      "draft",
      "configured",
      "validation_failed",
      "ready_to_build",
      "building",
      "firmware_ready",
      "awaiting_installation",
      "connecting",
      "online",
      "offline",
      "error",
      "configuration_missing",
    ] as EsphomeLifecycleState[],
  };
}

export async function previewManagedEsphomeDevice(
  raw: unknown,
  roomId?: string | null
) {
  const validation = validateEsphomeBuilderConfig(raw);
  if (!validation.valid) {
    return { validation, config: null, yaml: null, manifest: null, mapped: null };
  }

  const config = normalizeBuilderConfig(raw as EsphomeDeviceBuilderConfig);
  const yaml = generateEsphomeYaml(config);
  const slug = resolveBuilderSlug(config);
  const parsed = parseEsphomeYaml(yaml, slug, `devices/${slug}`);

  const manifest = buildEsphomeDriverManifest(parsed);
  let areaName: string | null = null;
  if (roomId) {
    const room = await getPool().query<{ name: string }>(
      `SELECT name FROM rooms WHERE id = $1`,
      [roomId]
    );
    areaName = room.rows[0]?.name ?? null;
  }

  const mapped = mapCandidatesToCapabilities(manifest.candidates, {
    deviceName: config.displayName,
    areaName,
  });

  return { validation, config, yaml, manifest, mapped, parsed };
}

export type CreateManagedEsphomeResult = {
  deviceId: string;
  yamlPath: string;
  lifecycleState: EsphomeLifecycleState;
  managementMode: EsphomeManagementMode;
  manifest: ReturnType<typeof buildEsphomeDriverManifest>;
  mapped: ReturnType<typeof mapCandidatesToCapabilities>;
  sync: { sensors: number; relays: number };
  classified: number;
};

export async function createManagedEsphomeDevice(input: {
  config: unknown;
  roomId?: string | null;
  systemOverrides?: Record<string, SystemId>;
}): Promise<CreateManagedEsphomeResult> {
  const preview = await previewManagedEsphomeDevice(input.config, input.roomId);
  if (!preview.validation.valid || !preview.config || !preview.parsed || !preview.manifest) {
    const first = preview.validation.issues[0];
    throw new Error(first?.message ?? "Invalid device configuration");
  }

  const config = preview.config;
  const slug = resolveBuilderSlug(config);
  const mqttRoot = installationMqttRoot();

  const existing = await getPool().query<{ id: string }>(
    `SELECT id FROM devices WHERE slug = $1 OR esphome_name = $2 LIMIT 1`,
    [slug, slug]
  );
  if (existing.rows[0]) {
    throw new Error(`A device named "${slug}" already exists`);
  }

  const { relativePath } = await writeManagedEsphomeYaml(config, preview.yaml!);

  const device = await createDevice({
    name: config.displayName,
    roomId: input.roomId ?? config.roomId ?? null,
    mqttTopicPrefix: `${mqttRoot}/${slug}`,
    esphomeName: slug,
    sensors: preview.parsed.sensors,
    relays: preview.parsed.relays,
  });

  await getPool().query(
    `UPDATE devices SET
       esphome_management_mode = 'managed',
       esphome_lifecycle_state = 'awaiting_installation',
       esphome_builder_config = $2::jsonb,
       esphome_yaml_path = $3,
       updated_at = NOW()
     WHERE id = $1`,
    [device.id, JSON.stringify(config), relativePath]
  );

  const { sync, classified } = await syncAndClassifyCapabilities(
    device.id,
    input.systemOverrides
  );
  await refreshTelemetrySubscriptions();

  const mapped = mapCandidatesToCapabilities(preview.manifest.candidates, {
    deviceName: config.displayName,
    areaName: device.roomName,
    systemOverrides: input.systemOverrides,
  });

  return {
    deviceId: device.id,
    yamlPath: relativePath,
    lifecycleState: "awaiting_installation",
    managementMode: "managed",
    manifest: preview.manifest,
    mapped,
    sync,
    classified,
  };
}

export async function getManagedBuilderConfig(
  deviceId: string
): Promise<EsphomeDeviceBuilderConfig> {
  const res = await getPool().query<{
    esphome_management_mode: string | null;
    esphome_builder_config: unknown;
  }>(
    `SELECT esphome_management_mode, esphome_builder_config FROM devices WHERE id = $1`,
    [deviceId]
  );
  const row = res.rows[0];
  if (!row) throw new Error("Device not found");
  if (row.esphome_management_mode !== "managed") {
    throw new Error("Only managed devices can be edited in the Device Builder");
  }
  if (!row.esphome_builder_config || typeof row.esphome_builder_config !== "object") {
    throw new Error("Builder configuration not found for this device");
  }
  return row.esphome_builder_config as EsphomeDeviceBuilderConfig;
}

export async function updateManagedEsphomeDevice(input: {
  deviceId: string;
  config: unknown;
  roomId?: string | null;
  systemOverrides?: Record<string, SystemId>;
}): Promise<CreateManagedEsphomeResult> {
  const device = await getDeviceDetailed(input.deviceId);
  if (!device) throw new Error("Device not found");
  if (device.esphomeManagementMode !== "managed") {
    throw new Error("Only managed devices can be edited in the Device Builder");
  }

  const lockedSlug = device.esphomeName || device.slug;
  const raw = input.config as EsphomeDeviceBuilderConfig;
  const merged = {
    ...raw,
    slug: lockedSlug,
    version: 1 as const,
  };

  const preview = await previewManagedEsphomeDevice(merged, input.roomId ?? device.roomId);
  if (!preview.validation.valid || !preview.config || !preview.parsed || !preview.manifest) {
    const first = preview.validation.issues[0];
    throw new Error(first?.message ?? "Invalid device configuration");
  }

  const config = { ...preview.config, slug: lockedSlug };
  const { relativePath } = await writeManagedEsphomeYaml(config, preview.yaml!);

  await getPool().query(
    `UPDATE devices SET
       name = $2,
       room_id = $3,
       esphome_builder_config = $4::jsonb,
       esphome_yaml_path = $5,
       esphome_lifecycle_state = 'configured',
       updated_at = NOW()
     WHERE id = $1`,
    [
      input.deviceId,
      config.displayName,
      input.roomId ?? config.roomId ?? device.roomId,
      JSON.stringify(config),
      relativePath,
    ]
  );

  const suggestion = await suggestFromEsphome(lockedSlug);
  if (suggestion) {
    await syncDeviceFromEsphomeSuggestion(input.deviceId, suggestion);
  }

  const { sync, classified } = await syncAndClassifyCapabilities(
    input.deviceId,
    input.systemOverrides
  );
  await refreshTelemetrySubscriptions();

  const updated = await getDeviceDetailed(input.deviceId);
  const mapped = mapCandidatesToCapabilities(preview.manifest.candidates, {
    deviceName: config.displayName,
    areaName: updated?.roomName ?? null,
    systemOverrides: input.systemOverrides,
  });

  return {
    deviceId: input.deviceId,
    yamlPath: relativePath,
    lifecycleState: "configured",
    managementMode: "managed",
    manifest: preview.manifest,
    mapped,
    sync,
    classified,
  };
}

export async function adoptEsphomeDeviceToManaged(deviceId: string): Promise<{
  deviceId: string;
  config: EsphomeDeviceBuilderConfig;
  managementMode: EsphomeManagementMode;
  firmwareReplaced: boolean;
}> {
  const device = await getDeviceDetailed(deviceId);
  if (!device) throw new Error("Device not found");
  if ((device.firmwareType || "esphome") !== "esphome") {
    throw new Error("Only ESPHome devices can be adopted into the Device Builder");
  }
  if (device.esphomeManagementMode === "managed") {
    throw new Error("Device is already managed by the Device Builder");
  }

  const slug = device.esphomeName?.trim() || device.slug;
  const yaml = (await loadEsphomeYaml(slug)) ?? (await loadEsphomeYamlMerged(slug));
  if (!yaml) throw new Error("ESPHome YAML not found for this device");

  const parsed = inferBuilderConfigFromYaml(yaml, slug, device.name);
  if (!parsed) {
    throw new Error(
      "Could not infer builder configuration from this YAML — use Advanced edit or keep as imported"
    );
  }

  const validation = validateEsphomeBuilderConfig({ ...parsed, slug });
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(first?.message ?? "Could not adopt YAML into builder configuration");
  }

  const replaced = nexternelFirmwareFromLegacyYaml(yaml, slug, device.name);
  const sourceConfig = replaced?.config ?? { ...parsed, slug };
  const config = preserveSpecifiedSensorTypes(
    normalizeBuilderConfig(sourceConfig),
    sourceConfig
  );
  const relativePath = device.esphomeYamlPath?.trim() || `${slug}.yaml`;
  if (replaced) {
    await writeDeviceYamlFile(relativePath, replaced.yaml);
  }

  await getPool().query(
    `UPDATE devices SET
       esphome_builder_config = $2::jsonb,
       esphome_management_mode = 'managed',
       esphome_yaml_path = $3,
       updated_at = NOW()
     WHERE id = $1`,
    [deviceId, JSON.stringify(config), relativePath]
  );

  return { deviceId, config, managementMode: "managed", firmwareReplaced: Boolean(replaced) };
}

/** Regenerate managed YAML from builder config when server file is missing. */
export async function restoreManagedEsphomeYaml(deviceId: string): Promise<{
  deviceId: string;
  yamlPath: string;
  lifecycleState: EsphomeLifecycleState;
}> {
  const device = await getDeviceDetailed(deviceId);
  if (!device) throw new Error("Device not found");
  if ((device.firmwareType || "esphome") !== "esphome") {
    throw new Error("Only ESPHome devices can restore YAML");
  }
  if (device.esphomeManagementMode !== "managed") {
    throw new Error("Only managed devices can regenerate YAML from the Device Builder");
  }

  const config = await getManagedBuilderConfig(deviceId);
  const preview = await previewManagedEsphomeDevice(config, device.roomId);
  if (!preview.validation.valid || !preview.config || !preview.yaml) {
    const first = preview.validation.issues[0];
    throw new Error(first?.message ?? "Invalid builder configuration");
  }

  const { relativePath } = await writeManagedEsphomeYaml(preview.config, preview.yaml);

  await getPool().query(
    `UPDATE devices SET
       esphome_yaml_path = $2,
       esphome_lifecycle_state = 'configured',
       updated_at = NOW()
     WHERE id = $1`,
    [deviceId, relativePath]
  );

  const suggestion = await suggestFromEsphome(device.esphomeName || device.slug);
  if (suggestion) {
    await syncDeviceFromEsphomeSuggestion(deviceId, suggestion);
  }
  await syncAndClassifyCapabilities(deviceId);
  await refreshTelemetrySubscriptions();

  return {
    deviceId,
    yamlPath: relativePath,
    lifecycleState: "configured",
  };
}
