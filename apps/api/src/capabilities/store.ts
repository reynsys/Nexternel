import { getPool } from "../db.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import {
  esphomeDevicePrefixAliases,
  esphomeSensorStateTopic,
  esphomeSwitchStateTopic,
} from "../telemetry/esphome-topics.js";

export type CapabilityRow = {
  id: string;
  device_id: string;
  device_name: string;
  room_id: string | null;
  room_name: string | null;
  kind: string;
  /** Name to show: your own name when set, else the device's. */
  name: string;
  /** The name the device reports. */
  original_name: string;
  custom_name: string | null;
  /** Icon id, or "auto" (chosen by the kind of reading). */
  icon: string | null;
  unit: string | null;
  source_type: string;
  source_id: string;
  is_enabled: boolean;
  state_topic: string | null;
  command_topic: string | null;
  firmware_type: string;
  system_id: string | null;
  area_id: string | null;
  group_id: string | null;
  service_id: string | null;
};

export async function listCapabilities(): Promise<CapabilityRow[]> {
  const result = await getPool().query<CapabilityRow>(
    `SELECT c.id, c.device_id, d.name AS device_name, d.room_id, r.name AS room_name,
            c.kind, COALESCE(NULLIF(c.custom_name, ''), c.name) AS name, c.name AS original_name, c.custom_name, c.icon,
            c.unit, c.source_type, c.source_id, c.is_enabled,
            c.system_id, c.area_id, c.group_id, c.service_id,
            b.state_topic, b.command_topic,
            COALESCE(d.firmware_type, 'esphome') AS firmware_type
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN rooms r ON r.id = d.room_id
     LEFT JOIN capability_bindings b ON b.capability_id = c.id
     WHERE c.is_enabled = TRUE
       AND COALESCE(d.is_enabled, TRUE) = TRUE
     ORDER BY COALESCE(r.name, ''), d.name ASC, COALESCE(NULLIF(c.custom_name, ''), c.name) ASC`
  );
  return result.rows;
}

export async function getCapabilityById(id: string): Promise<CapabilityRow | null> {
  const result = await getPool().query<CapabilityRow>(
    `SELECT c.id, c.device_id, d.name AS device_name, d.room_id, r.name AS room_name,
            c.kind, COALESCE(NULLIF(c.custom_name, ''), c.name) AS name, c.name AS original_name, c.custom_name, c.icon,
            c.unit, c.source_type, c.source_id, c.is_enabled,
            c.system_id, c.area_id, c.group_id, c.service_id,
            b.state_topic, b.command_topic,
            COALESCE(d.firmware_type, 'esphome') AS firmware_type
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN rooms r ON r.id = d.room_id
     LEFT JOIN capability_bindings b ON b.capability_id = c.id
     WHERE c.id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listStateTopicBindings(): Promise<
  { capability_id: string; state_topic: string; kind: string }[]
> {
  const result = await getPool().query<{
    capability_id: string;
    state_topic: string;
    kind: string;
  }>(
    `SELECT b.capability_id, b.state_topic, c.kind
     FROM capability_bindings b
     JOIN capabilities c ON c.id = b.capability_id
     JOIN devices d ON d.id = c.device_id
     WHERE b.state_topic IS NOT NULL AND b.state_topic <> ''
       AND c.is_enabled = TRUE
       AND COALESCE(d.firmware_type, 'esphome') <> 'octopus'`
  );
  return result.rows;
}

export async function listDevicePrefixes(): Promise<string[]> {
  const result = await getPool().query<{ mqtt_topic_prefix: string }>(
    `SELECT DISTINCT mqtt_topic_prefix FROM devices
     WHERE mqtt_topic_prefix IS NOT NULL AND mqtt_topic_prefix <> ''
       AND COALESCE(firmware_type, 'esphome') <> 'octopus'`
  );
  return result.rows.map((r) => r.mqtt_topic_prefix);
}

/** Shelly relays: prefix + switch:N → capability id (for events/rpc ingest). */
export async function listShellySwitchBindings(): Promise<
  { capability_id: string; mqtt_topic_prefix: string; component_key: string }[]
> {
  const result = await getPool().query<{
    capability_id: string;
    mqtt_topic_prefix: string;
    component_key: string;
  }>(
    `SELECT c.id AS capability_id,
            d.mqtt_topic_prefix,
            lower(r.esphome_entity_id) AS component_key
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     JOIN relays r ON r.id = c.source_id AND c.source_type = 'relay'
     WHERE COALESCE(d.firmware_type, 'esphome') = 'shelly'
       AND c.is_enabled = TRUE
       AND d.mqtt_topic_prefix IS NOT NULL AND d.mqtt_topic_prefix <> ''
       AND r.esphome_entity_id ~* '^(switch|relay):[0-9]+$'`
  );
  return result.rows;
}

export async function updateCapabilitySystemId(
  id: string,
  systemId: string | null
): Promise<boolean> {
  const result = await getPool().query(
    `UPDATE capabilities SET system_id = $2, updated_at = NOW() WHERE id = $1`,
    [id, systemId]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Expected live state topics from device prefix + entity id (plus slug aliases). */
export async function listEsphomeLiveEntities(): Promise<
  {
    capability_id: string;
    kind: string;
    prefix: string;
    slug: string;
    entity_id: string;
    segment: "sensor" | "switch";
    state_topic: string | null;
  }[]
> {
  const result = await getPool().query<{
    capability_id: string;
    kind: string;
    prefix: string;
    slug: string;
    entity_id: string | null;
    source_type: string;
    state_topic: string | null;
  }>(
    `SELECT c.id AS capability_id, c.kind, d.mqtt_topic_prefix AS prefix, d.slug,
            c.source_type,
            CASE
              WHEN c.source_type = 'sensor' THEN COALESCE(NULLIF(TRIM(s.esphome_entity_id), ''), s.slug)
              WHEN c.source_type = 'relay' THEN COALESCE(NULLIF(TRIM(r.esphome_entity_id), ''), r.slug)
              ELSE NULL
            END AS entity_id,
            CASE
              WHEN c.source_type = 'sensor' THEN s.mqtt_state_topic
              WHEN c.source_type = 'relay' THEN r.mqtt_state_topic
              ELSE NULL
            END AS state_topic
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN sensors s ON c.source_type = 'sensor' AND s.id = c.source_id
     LEFT JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     WHERE c.is_enabled = TRUE
       AND COALESCE(d.is_enabled, TRUE) = TRUE
       AND COALESCE(d.firmware_type, 'esphome') NOT IN ('shelly', 'octopus')
       AND d.mqtt_topic_prefix IS NOT NULL AND d.mqtt_topic_prefix <> ''`
  );

  const out: {
    capability_id: string;
    kind: string;
    prefix: string;
    slug: string;
    entity_id: string;
    segment: "sensor" | "switch";
    state_topic: string | null;
  }[] = [];
  for (const row of result.rows) {
    if (!row.entity_id) continue;
    out.push({
      capability_id: row.capability_id,
      kind: row.kind,
      prefix: row.prefix,
      slug: row.slug,
      entity_id: row.entity_id,
      segment: row.source_type === "relay" ? "switch" : "sensor",
      state_topic: row.state_topic,
    });
  }
  return out;
}

/** Expected live state topics from device prefix + entity id (plus slug aliases). */
export async function listEsphomeCanonicalStateTopics(): Promise<
  { capability_id: string; state_topic: string; kind: string }[]
> {
  const installRoot = installationMqttRoot();
  const result = await getPool().query<{
    capability_id: string;
    kind: string;
    prefix: string;
    slug: string;
    entity_id: string | null;
    source_type: string;
  }>(
    `SELECT c.id AS capability_id, c.kind, d.mqtt_topic_prefix AS prefix, d.slug,
            c.source_type,
            CASE
              WHEN c.source_type = 'sensor' THEN COALESCE(NULLIF(TRIM(s.esphome_entity_id), ''), s.slug)
              WHEN c.source_type = 'relay' THEN COALESCE(NULLIF(TRIM(r.esphome_entity_id), ''), r.slug)
              ELSE NULL
            END AS entity_id
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN sensors s ON c.source_type = 'sensor' AND s.id = c.source_id
     LEFT JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     WHERE c.is_enabled = TRUE
       AND COALESCE(d.is_enabled, TRUE) = TRUE
       AND COALESCE(d.firmware_type, 'esphome') NOT IN ('shelly', 'octopus')
       AND d.mqtt_topic_prefix IS NOT NULL AND d.mqtt_topic_prefix <> ''`
  );

  const out: { capability_id: string; state_topic: string; kind: string }[] = [];
  const seen = new Set<string>();
  for (const row of result.rows) {
    if (!row.entity_id) continue;
    for (const prefix of esphomeDevicePrefixAliases(
      row.prefix,
      row.slug,
      installRoot
    )) {
      const topic =
        row.source_type === "relay"
          ? esphomeSwitchStateTopic(prefix, row.entity_id)
          : esphomeSensorStateTopic(prefix, row.entity_id);
      const key = `${topic}\0${row.capability_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        capability_id: row.capability_id,
        state_topic: topic,
        kind: row.kind,
      });
    }
  }
  return out;
}
