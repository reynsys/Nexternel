import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { preferCatalogDisplayName } from "./display-name.js";
import type { EsphomeImportSuggestion } from "../esphome/yaml.js";
import { suggestFromEsphomeCandidates } from "../esphome/yaml.js";
import { removeDeviceYamlFile } from "../esphome/builder/storage.js";
import {
  buildShellyGen1RelayTopics,
  buildShellyGen1TopicPrefix,
  buildShellySwitchTopics,
  isShellyGen1MqttPrefix,
  resolveShellyGen,
} from "../shelly/topics.js";
import { buildShellyRelays, resolveShellySwitchCount } from "../shelly/suggest.js";
import { assertValidShellyMqttPrefix } from "../shelly/validate.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import {
  deriveDeviceConnectivityState,
  type DeviceConnectivityState,
  type MqttAvailability,
} from "./connectivity.js";
import { getLiveState } from "../telemetry/state-cache.js";
import { deviceSlugFromTopicPrefix, slugify } from "./slug.js";

export type RelayInsert = EsphomeImportSuggestion["relays"][number] & {
  /** Absolute topics (Shelly); when set, ESPHome path templates are not used. */
  mqttCommandTopic?: string;
  mqttStateTopic?: string;
};

export type DeviceDetail = {
  id: string;
  roomId: string | null;
  roomName: string | null;
  name: string;
  slug: string;
  mqttTopicPrefix: string;
  esphomeName: string | null;
  firmwareType: string;
  ipAddress: string | null;
  macAddress: string | null;
  isEnabled: boolean;
  isOnline: boolean;
  connectivityState: DeviceConnectivityState;
  lastSeenAt: string | null;
  esphomeManagementMode?: string | null;
  esphomeLifecycleState?: string | null;
  esphomeYamlPath?: string | null;
  sensors: {
    id: string;
    name: string;
    slug: string;
    sensorType: string;
    unit: string | null;
    esphomeEntityId: string | null;
    mqttStateTopic: string;
    isEnabled: boolean;
    capabilityId: string | null;
    systemId: string | null;
    /** Your own name for it when set (the reading's), else null — `name` stays the device's. */
    customName: string | null;
    icon: string | null;
  }[];
  relays: {
    id: string;
    name: string;
    slug: string;
    esphomeEntityId: string | null;
    mqttCommandTopic: string;
    mqttStateTopic: string;
    lastState: string | null;
    isEnabled: boolean;
    capabilityId: string | null;
    systemId: string | null;
    /** Your own name for it when set (the reading's), else null — `name` stays the device's. */
    customName: string | null;
    icon: string | null;
  }[];
};

type DeviceRow = {
  id: string;
  room_id: string | null;
  room_name: string | null;
  name: string;
  slug: string;
  mqtt_topic_prefix: string;
  esphome_name: string | null;
  firmware_type: string;
  ip_address: string | null;
  mac_address: string | null;
  is_enabled: boolean;
  mqtt_availability: string;
  last_seen_at: Date | null;
  esphome_management_mode: string | null;
  esphome_lifecycle_state: string | null;
  esphome_yaml_path: string | null;
};

export async function listDevicesDetailed(): Promise<DeviceDetail[]> {
  const pool = getPool();
  const devices = await pool.query<DeviceRow>(
    `SELECT d.id, d.room_id, r.name AS room_name, d.name, d.slug,
            d.mqtt_topic_prefix, d.esphome_name,
            COALESCE(d.firmware_type, 'esphome') AS firmware_type,
            host(d.ip_address)::text AS ip_address, d.mac_address,
            COALESCE(d.is_enabled, TRUE) AS is_enabled,
            d.mqtt_availability, d.last_seen_at,
            d.esphome_management_mode, d.esphome_lifecycle_state, d.esphome_yaml_path
     FROM devices d
     LEFT JOIN rooms r ON r.id = d.room_id
     ORDER BY d.name ASC`
  );

  if (devices.rows.length === 0) return [];

  const ids = devices.rows.map((d) => d.id);
  const sensors = await pool.query<{
    id: string;
    device_id: string;
    name: string;
    slug: string;
    sensor_type: string;
    unit: string | null;
    esphome_entity_id: string | null;
    mqtt_state_topic: string;
    is_enabled: boolean;
    capability_id: string | null;
    system_id: string | null;
    custom_name: string | null;
    icon: string | null;
  }>(
    `SELECT s.id, s.device_id, s.name, s.slug, s.sensor_type, s.unit, s.esphome_entity_id,
            s.mqtt_state_topic, COALESCE(s.is_enabled, TRUE) AS is_enabled,
            c.id AS capability_id, c.system_id, c.custom_name, c.icon
     FROM sensors s
     LEFT JOIN capabilities c ON c.source_type = 'sensor' AND c.source_id = s.id
     WHERE s.device_id = ANY($1::uuid[])
     ORDER BY s.name ASC`,
    [ids]
  );
  const relays = await pool.query<{
    id: string;
    device_id: string;
    name: string;
    slug: string;
    esphome_entity_id: string | null;
    mqtt_command_topic: string;
    mqtt_state_topic: string;
    last_state: string | null;
    is_enabled: boolean;
    capability_id: string | null;
    system_id: string | null;
    custom_name: string | null;
    icon: string | null;
  }>(
    `SELECT r.id, r.device_id, r.name, r.slug, r.esphome_entity_id,
            r.mqtt_command_topic, r.mqtt_state_topic, r.last_state,
            COALESCE(r.is_enabled, TRUE) AS is_enabled,
            c.id AS capability_id, c.system_id, c.custom_name, c.icon
     FROM relays r
     LEFT JOIN capabilities c ON c.source_type = 'relay' AND c.source_id = r.id
     WHERE r.device_id = ANY($1::uuid[])
     ORDER BY r.name ASC`,
    [ids]
  );

  const sensorsByDevice = new Map<string, DeviceDetail["sensors"]>();
  for (const s of sensors.rows) {
    const list = sensorsByDevice.get(s.device_id) ?? [];
    list.push({
      id: s.id,
      name: s.name,
      slug: s.slug,
      sensorType: s.sensor_type,
      unit: s.unit,
      esphomeEntityId: s.esphome_entity_id,
      mqttStateTopic: s.mqtt_state_topic,
      isEnabled: s.is_enabled,
      capabilityId: s.capability_id,
      systemId: s.system_id,
      customName: s.custom_name,
      icon: s.icon,
    });
    sensorsByDevice.set(s.device_id, list);
  }

  const relaysByDevice = new Map<string, DeviceDetail["relays"]>();
  for (const r of relays.rows) {
    const list = relaysByDevice.get(r.device_id) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      slug: r.slug,
      esphomeEntityId: r.esphome_entity_id,
      mqttCommandTopic: r.mqtt_command_topic,
      mqttStateTopic: r.mqtt_state_topic,
      lastState: r.last_state,
      isEnabled: r.is_enabled,
      capabilityId: r.capability_id,
      systemId: r.system_id,
      customName: r.custom_name,
      icon: r.icon,
    });
    relaysByDevice.set(r.device_id, list);
  }

  return devices.rows.map((d) => {
    const sensors = sensorsByDevice.get(d.id) ?? [];
    const relays = relaysByDevice.get(d.id) ?? [];
    const capabilityLive = [];
    for (const s of sensors) {
      if (!s.capabilityId) continue;
      const live = getLiveState(s.capabilityId);
      if (live) {
        capabilityLive.push({
          kind: "sensor",
          quality: live.quality,
          updatedAt: live.updatedAt,
        });
      }
    }
    for (const r of relays) {
      if (!r.capabilityId) continue;
      const live = getLiveState(r.capabilityId);
      if (live) {
        capabilityLive.push({
          kind: "switch",
          quality: live.quality,
          updatedAt: live.updatedAt,
        });
      }
    }
    const mqttAvailability = normalizeMqttAvailability(d.mqtt_availability);
    const connectivityState = deriveDeviceConnectivityState({
      firmwareType: d.firmware_type || "esphome",
      isEnabled: d.is_enabled,
      mqttAvailability,
      lastSeenAt: d.last_seen_at ? d.last_seen_at.toISOString() : null,
      sensorCount: sensors.length,
      relayCount: relays.length,
      capabilityLive,
    });
    return {
      id: d.id,
      roomId: d.room_id,
      roomName: d.room_name,
      name: d.name,
      slug: d.slug,
      mqttTopicPrefix: d.mqtt_topic_prefix,
      esphomeName: d.esphome_name,
      firmwareType: d.firmware_type || "esphome",
      ipAddress: d.ip_address,
      macAddress: d.mac_address,
      isEnabled: d.is_enabled,
      connectivityState,
      isOnline: connectivityState === "online",
      lastSeenAt: d.last_seen_at ? d.last_seen_at.toISOString() : null,
      esphomeManagementMode: d.esphome_management_mode,
      esphomeLifecycleState: d.esphome_lifecycle_state,
      esphomeYamlPath: d.esphome_yaml_path,
      sensors,
      relays,
    };
  });
}

function normalizeMqttAvailability(value: string | null | undefined): MqttAvailability {
  if (value === "online" || value === "offline") return value;
  return "unknown";
}

export async function getDeviceDetailed(id: string): Promise<DeviceDetail | null> {
  const all = await listDevicesDetailed();
  return all.find((d) => d.id === id) ?? null;
}

/** YAML lookup names for an ESPHome device (esphome name, slug, MQTT prefix tail). */
export function esphomeNameCandidates(
  device: Pick<DeviceDetail, "esphomeName" | "slug" | "mqttTopicPrefix">
): string[] {
  const out: string[] = [];
  if (device.esphomeName?.trim()) out.push(device.esphomeName.trim());
  if (device.slug?.trim()) out.push(device.slug.trim());
  const tail = device.mqttTopicPrefix?.split("/").pop()?.trim();
  if (tail) out.push(tail);
  return [...new Set(out)];
}

export async function esphomeSuggestionForDevice(
  device: Pick<DeviceDetail, "esphomeName" | "slug" | "mqttTopicPrefix">
): Promise<EsphomeImportSuggestion | null> {
  return suggestFromEsphomeCandidates(esphomeNameCandidates(device));
}

async function pruneOrphanSensorsAndRelays(
  client: PoolClient,
  deviceId: string,
  sensorSlugs: string[],
  relaySlugs: string[]
) {
  if (sensorSlugs.length > 0) {
    await client.query(
      `DELETE FROM capabilities
       WHERE source_type = 'sensor'
         AND source_id IN (
           SELECT id FROM sensors
           WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))
         )`,
      [deviceId, sensorSlugs]
    );
    await client.query(
      `DELETE FROM sensors WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`,
      [deviceId, sensorSlugs]
    );
  }

  // Empty relaySlugs → YAML has no switches; remove all relays for this device.
  await client.query(
    `DELETE FROM capabilities
     WHERE source_type = 'relay'
       AND source_id IN (
         SELECT id FROM relays
         WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))
       )`,
    [deviceId, relaySlugs]
  );
  await client.query(
    `DELETE FROM relays WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`,
    [deviceId, relaySlugs]
  );
}

async function upsertSensorFromSuggestion(
  client: PoolClient,
  deviceId: string,
  mqttTopicPrefix: string,
  s: EsphomeImportSuggestion["sensors"][number]
) {
  const displayName = preferCatalogDisplayName(s.name, s.esphomeEntityId);
  const stateTopic = `${mqttTopicPrefix}/sensor/${s.esphomeEntityId}/state`;
  const matchers: { sql: string; params: unknown[] }[] = [
    { sql: "esphome_entity_id = $2", params: [s.esphomeEntityId] },
    { sql: "slug = $2", params: [s.slug] },
    { sql: "name = $2", params: [displayName] },
  ];
  if (s.sensorType === "power") {
    matchers.push({ sql: "sensor_type = $2", params: ["power"] });
  }
  if (s.sensorType === "energy") {
    const hint = /daily/i.test(s.name) ? "%daily%" : "%total%";
    matchers.push({
      sql: "sensor_type = $2 AND LOWER(name) LIKE $3",
      params: ["energy", hint],
    });
  }
  if (s.sensorType === "pm25" || s.sensorType === "pm10" || s.sensorType === "pm1") {
    matchers.push({ sql: "sensor_type = $2", params: [s.sensorType] });
    const hint =
      s.sensorType === "pm25"
        ? "%2.5%"
        : s.sensorType === "pm10"
          ? "%10%"
          : "%1.0%";
    matchers.push({
      sql: "sensor_type = $2 AND LOWER(name) LIKE $3",
      params: [s.sensorType, hint],
    });
  }
  if (s.sensorType === "temperature") {
    matchers.push({
      sql: "sensor_type = $2 AND LOWER(name) LIKE '%temp%'",
      params: ["temperature"],
    });
  }
  if (s.sensorType === "humidity") {
    matchers.push({
      sql: "sensor_type = $2 AND LOWER(name) LIKE '%humid%'",
      params: ["humidity"],
    });
  }

  for (const m of matchers) {
    const result = await client.query(
      `UPDATE sensors SET
         name = $3,
         slug = $4,
         sensor_type = $5,
         unit = $6,
         mqtt_state_topic = $7,
         esphome_entity_id = $8,
         updated_at = NOW()
       WHERE device_id = $1 AND ${m.sql}
       RETURNING id`,
      [
        deviceId,
        ...m.params,
        displayName,
        s.slug,
        s.sensorType,
        s.unit ?? null,
        stateTopic,
        s.esphomeEntityId,
      ]
    );
    if ((result.rowCount ?? 0) > 0) return;
  }

  await client.query(
    `INSERT INTO sensors (
       device_id, name, slug, sensor_type, unit, mqtt_state_topic, esphome_entity_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (device_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       sensor_type = EXCLUDED.sensor_type,
       unit = EXCLUDED.unit,
       mqtt_state_topic = EXCLUDED.mqtt_state_topic,
       esphome_entity_id = EXCLUDED.esphome_entity_id,
       updated_at = NOW()`,
    [
      deviceId,
      displayName,
      s.slug,
      s.sensorType,
      s.unit ?? null,
      stateTopic,
      s.esphomeEntityId,
    ]
  );
}

async function insertSensorsAndRelays(
  client: PoolClient,
  deviceId: string,
  mqttTopicPrefix: string,
  sensors: EsphomeImportSuggestion["sensors"],
  relays: RelayInsert[],
  firmwareType = "esphome",
  pruneOrphans = false
) {
  for (const s of sensors) {
    await upsertSensorFromSuggestion(client, deviceId, mqttTopicPrefix, s);
  }

  if (pruneOrphans && sensors.length > 0) {
    await pruneOrphanSensorsAndRelays(
      client,
      deviceId,
      sensors.map((s) => s.slug),
      relays.map((r) => r.slug)
    );
  } else if (pruneOrphans) {
    await pruneOrphanSensorsAndRelays(client, deviceId, [], relays.map((r) => r.slug));
  }

  for (const r of relays) {
    const relayName = preferCatalogDisplayName(r.name, r.esphomeEntityId);
    const useAbsolute =
      firmwareType === "shelly" ||
      (typeof r.mqttCommandTopic === "string" &&
        typeof r.mqttStateTopic === "string");
    const commandTopic = useAbsolute
      ? (r.mqttCommandTopic as string)
      : `${mqttTopicPrefix}/switch/${r.esphomeEntityId}/command`;
    const stateTopic = useAbsolute
      ? (r.mqttStateTopic as string)
      : `${mqttTopicPrefix}/switch/${r.esphomeEntityId}/state`;

    await client.query(
      `INSERT INTO relays (
         device_id, name, slug, mqtt_command_topic, mqtt_state_topic,
         esphome_entity_id, gpio_pin
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (device_id, slug) DO UPDATE SET
         name = EXCLUDED.name,
         mqtt_command_topic = EXCLUDED.mqtt_command_topic,
         mqtt_state_topic = EXCLUDED.mqtt_state_topic,
         esphome_entity_id = EXCLUDED.esphome_entity_id,
         gpio_pin = EXCLUDED.gpio_pin,
         updated_at = NOW()`,
      [
        deviceId,
        relayName,
        r.slug,
        commandTopic,
        stateTopic,
        r.esphomeEntityId,
        r.gpioPin ?? null,
      ]
    );
  }
}

export async function createDevice(input: {
  name: string;
  roomId?: string | null;
  mqttTopicPrefix: string;
  esphomeName?: string | null;
  firmwareType?: string;
  shellyChannel?: number;
  /** Phase 3: number of switch outputs (overrides single-channel default). */
  shellySwitchCount?: number;
  shellyModelId?: string | null;
  /** 1 = Gen1 (SHSW-1, …), 2 = Gen2/Gen3. */
  shellyGen?: number;
  ipAddress?: string | null;
  macAddress?: string | null;
  sensors?: EsphomeImportSuggestion["sensors"];
  relays?: RelayInsert[];
}): Promise<DeviceDetail> {
  const firmwareType = (input.firmwareType || "esphome").trim().toLowerCase();
  let mqttTopicPrefix = input.mqttTopicPrefix.trim().replace(/\/+$/, "");
  if (firmwareType === "shelly") {
    const shellyGen = resolveShellyGen(input.shellyGen, mqttTopicPrefix);
    if (shellyGen === 1) {
      mqttTopicPrefix = isShellyGen1MqttPrefix(mqttTopicPrefix)
        ? mqttTopicPrefix
        : buildShellyGen1TopicPrefix(mqttTopicPrefix);
    } else {
      assertValidShellyMqttPrefix(mqttTopicPrefix, installationMqttRoot());
    }
  }
  const slug = deviceSlugFromTopicPrefix(mqttTopicPrefix) || slugify(input.name);
  const esphomeName =
    firmwareType === "shelly"
      ? null
      : (input.esphomeName || slug).trim();

  let sensors = input.sensors ?? [];
  let relays = input.relays ?? [];

  if (firmwareType === "shelly" && relays.length === 0) {
    const shellyGen = resolveShellyGen(input.shellyGen, mqttTopicPrefix);
    const switchCount = resolveShellySwitchCount({
      shellyModelId: input.shellyModelId,
      shellySwitchCount: input.shellySwitchCount,
      shellyChannel: input.shellyChannel,
    });
    // Legacy: shellyChannel > 0 with no count → single relay on that channel index.
    if (
      switchCount === 1 &&
      typeof input.shellyChannel === "number" &&
      input.shellyChannel > 0 &&
      !input.shellyModelId &&
      input.shellySwitchCount == null
    ) {
      const topics =
        shellyGen === 1
          ? buildShellyGen1RelayTopics(mqttTopicPrefix, input.shellyChannel)
          : buildShellySwitchTopics(mqttTopicPrefix, input.shellyChannel);
      relays = [
        {
          name: input.name.trim() || "Switch",
          slug: topics.slug,
          esphomeEntityId: topics.entityId,
          mqttCommandTopic: topics.commandTopic,
          mqttStateTopic: topics.stateTopic,
        },
      ];
    } else {
      relays = buildShellyRelays({
        deviceName: input.name.trim() || "Shelly",
        topicPrefix: mqttTopicPrefix,
        switchCount,
        shellyGen,
      });
    }
  }

  const pool = getPool();
  const client = await pool.connect();
  let deviceId = "";
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO devices (
         name, slug, room_id, mqtt_topic_prefix, esphome_name, firmware_type,
         ip_address, mac_address
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         NULLIF($7, '')::inet,
         NULLIF($8, '')
       )
       RETURNING id`,
      [
        input.name.trim(),
        slug,
        input.roomId || null,
        mqttTopicPrefix,
        esphomeName,
        firmwareType,
        input.ipAddress?.trim() || "",
        input.macAddress?.trim() || "",
      ]
    );
    deviceId = inserted.rows[0]!.id;
    await insertSensorsAndRelays(
      client,
      deviceId,
      mqttTopicPrefix,
      sensors,
      relays,
      firmwareType
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const created = await getDeviceDetailed(deviceId);
  if (!created) throw new Error("Device created but could not be loaded");
  return created;
}

export async function updateDevice(
  id: string,
  patch: {
    name?: string;
    roomId?: string | null;
    mqttTopicPrefix?: string;
    esphomeName?: string | null;
    ipAddress?: string | null;
    macAddress?: string | null;
    isEnabled?: boolean;
  }
): Promise<DeviceDetail | null> {
  const existing = await getPool().query<{
    id: string;
    name: string;
    room_id: string | null;
    mqtt_topic_prefix: string;
    esphome_name: string | null;
    firmware_type: string;
    ip_address: string | null;
    mac_address: string | null;
    is_enabled: boolean;
  }>(
    `SELECT id, name, room_id, mqtt_topic_prefix, esphome_name,
            COALESCE(firmware_type, 'esphome') AS firmware_type,
            host(ip_address)::text AS ip_address, mac_address,
            COALESCE(is_enabled, TRUE) AS is_enabled
     FROM devices WHERE id = $1`,
    [id]
  );
  if (existing.rowCount === 0) return null;
  const cur = existing.rows[0]!;

  const name = patch.name !== undefined ? patch.name.trim() : cur.name;
  if (!name) throw new Error("Name cannot be empty");

  const roomId = patch.roomId !== undefined ? patch.roomId || null : cur.room_id;
  const mqttTopicPrefix =
    patch.mqttTopicPrefix !== undefined
      ? patch.mqttTopicPrefix.trim().replace(/\/+$/, "")
      : cur.mqtt_topic_prefix;
  if (!mqttTopicPrefix) throw new Error("MQTT topic prefix is required");

  if (cur.firmware_type === "shelly" && !isShellyGen1MqttPrefix(mqttTopicPrefix)) {
    assertValidShellyMqttPrefix(mqttTopicPrefix, installationMqttRoot());
  }

  const esphomeName =
    patch.esphomeName !== undefined
      ? patch.esphomeName?.trim() || null
      : cur.esphome_name;
  const ipAddress =
    patch.ipAddress !== undefined ? patch.ipAddress?.trim() || null : cur.ip_address;
  const macAddress =
    patch.macAddress !== undefined ? patch.macAddress?.trim() || null : cur.mac_address;
  const isEnabled =
    patch.isEnabled !== undefined ? Boolean(patch.isEnabled) : cur.is_enabled;

  const prefixChanged = mqttTopicPrefix !== cur.mqtt_topic_prefix;

  await getPool().query(
    `UPDATE devices SET
       name = $2,
       room_id = $3,
       mqtt_topic_prefix = $4,
       esphome_name = $5,
       ip_address = NULLIF($6, '')::inet,
       mac_address = NULLIF($7, ''),
       is_enabled = $8,
       updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      name,
      roomId,
      mqttTopicPrefix,
      esphomeName,
      ipAddress ?? "",
      macAddress ?? "",
      isEnabled,
    ]
  );

  if (prefixChanged) {
    if (cur.firmware_type === "shelly") {
      const relays = await getPool().query<{
        id: string;
        esphome_entity_id: string | null;
      }>(`SELECT id, esphome_entity_id FROM relays WHERE device_id = $1`, [id]);
      const shellyGen = resolveShellyGen(undefined, mqttTopicPrefix);
      for (const r of relays.rows) {
        const relayM = /^relay:(\d+)$/i.exec(r.esphome_entity_id || "");
        const switchM = /^switch:(\d+)$/i.exec(r.esphome_entity_id || "");
        const channel = relayM ? Number(relayM[1]) : switchM ? Number(switchM[1]) : 0;
        const useGen1 = shellyGen === 1 || relayM != null;
        const topics = useGen1
          ? buildShellyGen1RelayTopics(mqttTopicPrefix, channel)
          : buildShellySwitchTopics(mqttTopicPrefix, channel);
        await getPool().query(
          `UPDATE relays SET
             mqtt_state_topic = $2,
             mqtt_command_topic = $3,
             updated_at = NOW()
           WHERE id = $1`,
          [r.id, topics.stateTopic, topics.commandTopic]
        );
      }
    } else {
      await getPool().query(
        `UPDATE sensors SET
           mqtt_state_topic = $2 || '/sensor/' || COALESCE(esphome_entity_id, slug) || '/state',
           updated_at = NOW()
         WHERE device_id = $1`,
        [id, mqttTopicPrefix]
      );
      await getPool().query(
        `UPDATE relays SET
           mqtt_state_topic = $2 || '/switch/' || COALESCE(esphome_entity_id, slug) || '/state',
           mqtt_command_topic = $2 || '/switch/' || COALESCE(esphome_entity_id, slug) || '/command',
           updated_at = NOW()
         WHERE device_id = $1`,
        [id, mqttTopicPrefix]
      );
    }
  }

  if (patch.roomId !== undefined && roomId !== cur.room_id) {
    const { syncCapabilityAreasFromDevices } = await import(
      "../capabilities/classify.js"
    );
    await syncCapabilityAreasFromDevices();
  }

  return getDeviceDetailed(id);
}

export async function deleteDevice(
  id: string,
  options?: { deleteYaml?: boolean }
): Promise<boolean> {
  const meta = await getPool().query<{
    firmware_type: string;
    esphome_yaml_path: string | null;
    esphome_name: string | null;
    slug: string;
    esphome_management_mode: string | null;
  }>(
    `SELECT firmware_type, esphome_yaml_path, esphome_name, slug, esphome_management_mode
     FROM devices WHERE id = $1`,
    [id]
  );
  const row = meta.rows[0];

  const result = await getPool().query(`DELETE FROM devices WHERE id = $1 RETURNING id`, [
    id,
  ]);
  const deleted = (result.rowCount ?? 0) > 0;

  if (deleted && row?.firmware_type === "esphome") {
    const mode = row.esphome_management_mode?.trim() || "imported";
    const shouldDeleteYaml = options?.deleteYaml ?? mode === "managed";
    if (shouldDeleteYaml) {
      const yamlPath =
        row.esphome_yaml_path?.trim() ||
        (row.esphome_name ? `${row.esphome_name}.yaml` : `${row.slug}.yaml`);
      await removeDeviceYamlFile(yamlPath);
    }
  }

  return deleted;
}

/** Re-import YAML for every ESPHome device — prunes ghost relays (e.g. removed Fan Relay). */
export async function reconcileAllEsphomeDevicesFromYaml(): Promise<{
  reconciled: number;
  skipped: number;
  errors: number;
  removedRelays: number;
  removedSensors: number;
}> {
  const devices = await listDevicesDetailed();
  let reconciled = 0;
  let skipped = 0;
  let errors = 0;
  let removedRelays = 0;
  let removedSensors = 0;

  for (const d of devices) {
    if (d.firmwareType !== "esphome") {
      skipped += 1;
      continue;
    }
    const suggestion = await esphomeSuggestionForDevice(d);
    if (!suggestion) {
      skipped += 1;
      continue;
    }
    try {
      const stats = await syncDeviceFromEsphomeSuggestion(d.id, suggestion);
      reconciled += 1;
      removedRelays += stats.removedRelays;
      removedSensors += stats.removedSensors;
    } catch {
      errors += 1;
    }
  }

  return { reconciled, skipped, errors, removedRelays, removedSensors };
}

export async function syncDeviceFromEsphomeSuggestion(
  id: string,
  suggestion: EsphomeImportSuggestion
): Promise<{
  addedRelays: number;
  updatedRelays: number;
  totalRelays: number;
  removedRelays: number;
  removedSensors: number;
}> {
  const device = await getDeviceDetailed(id);
  if (!device) throw new Error("Device not found");
  if (device.firmwareType === "shelly") {
    throw new Error("ESPHome sync is not available for Shelly devices");
  }

  const mqttTopicPrefix = suggestion.mqttTopicPrefix || device.mqttTopicPrefix;
  const pool = getPool();
  const before = await pool.query<{ slug: string }>(
    `SELECT slug FROM relays WHERE device_id = $1`,
    [id]
  );
  const beforeSensorSlugs = new Set(
    (
      await pool.query<{ slug: string }>(`SELECT slug FROM sensors WHERE device_id = $1`, [
        id,
      ])
    ).rows.map((r) => r.slug)
  );
  const beforeRelaySlugs = new Set(before.rows.map((r) => r.slug));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE devices SET
         mqtt_topic_prefix = $2,
         esphome_name = COALESCE($3, esphome_name),
         updated_at = NOW()
       WHERE id = $1`,
      [id, mqttTopicPrefix, suggestion.esphomeName || null]
    );
    await insertSensorsAndRelays(
      client,
      id,
      mqttTopicPrefix,
      suggestion.sensors,
      suggestion.relays,
      device.firmwareType,
      true
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const after = await pool.query<{ slug: string }>(
    `SELECT slug FROM relays WHERE device_id = $1`,
    [id]
  );
  const afterSensorSlugs = new Set(
    (
      await pool.query<{ slug: string }>(`SELECT slug FROM sensors WHERE device_id = $1`, [
        id,
      ])
    ).rows.map((r) => r.slug)
  );
  const afterRelaySlugs = new Set(after.rows.map((r) => r.slug));
  let addedRelays = 0;
  let updatedRelays = 0;
  for (const row of after.rows) {
    if (beforeRelaySlugs.has(row.slug)) updatedRelays += 1;
    else addedRelays += 1;
  }
  const removedRelays = [...beforeRelaySlugs].filter((s) => !afterRelaySlugs.has(s)).length;
  const removedSensors = [...beforeSensorSlugs].filter((s) => !afterSensorSlugs.has(s)).length;

  return {
    addedRelays,
    updatedRelays,
    totalRelays: after.rows.length,
    removedRelays,
    removedSensors,
  };
}

/** Your own name for a relay. The relay keeps the device's name, so device updates cannot undo it. */
export async function renameRelay(relayId: string, name: string): Promise<boolean> {
  const { renameCapabilityBySource } = await import("../capabilities/settings.js");
  return renameCapabilityBySource("relay", relayId, name);
}

/** Your own name for a sensor. The sensor keeps the device's name, so device updates cannot undo it. */
export async function renameSensor(sensorId: string, name: string): Promise<boolean> {
  const { renameCapabilityBySource } = await import("../capabilities/settings.js");
  return renameCapabilityBySource("sensor", sensorId, name);
}

export async function deleteSensor(deviceId: string, sensorId: string): Promise<boolean> {
  const pool = getPool();
  const owned = await pool.query(`SELECT id FROM sensors WHERE id = $1 AND device_id = $2`, [
    sensorId,
    deviceId,
  ]);
  if ((owned.rowCount ?? 0) === 0) return false;
  await pool.query(`DELETE FROM capabilities WHERE source_type = 'sensor' AND source_id = $1`, [
    sensorId,
  ]);
  const deleted = await pool.query(`DELETE FROM sensors WHERE id = $1 RETURNING id`, [sensorId]);
  return (deleted.rowCount ?? 0) > 0;
}

export async function deleteRelay(deviceId: string, relayId: string): Promise<boolean> {
  const pool = getPool();
  const owned = await pool.query(`SELECT id FROM relays WHERE id = $1 AND device_id = $2`, [
    relayId,
    deviceId,
  ]);
  if ((owned.rowCount ?? 0) === 0) return false;
  await pool.query(`DELETE FROM capabilities WHERE source_type = 'relay' AND source_id = $1`, [
    relayId,
  ]);
  const deleted = await pool.query(`DELETE FROM relays WHERE id = $1 RETURNING id`, [relayId]);
  return (deleted.rowCount ?? 0) > 0;
}
