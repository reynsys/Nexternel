import { getPool } from "../db.js";
import { collectOldTopicRoots } from "../backup/topic-roots.js";
import { remapTopicForLegacyRoots } from "../migrate/topic-remap.js";

export function installationMqttRoot(): string {
  return (process.env.MQTT_TOPIC_PREFIX || "nexternel").trim() || "nexternel";
}

/** Detect legacy installation roots (e.g. damnhome) — never shellies/ or device-native Shelly prefixes. */
export function detectLegacyInstallationRoots(prefixes: string[]): string[] {
  const current = installationMqttRoot();
  return collectOldTopicRoots(undefined, prefixes).filter((r) => r !== current);
}

/**
 * Align devices/sensors/relays to this installation's MQTT_TOPIC_PREFIX.
 * Only remaps topics whose first segment is a known legacy installation root.
 * Does not touch Shelly device-native prefixes (shellies/…, shellyplus…).
 */
export async function alignInstallationMqttTopics(): Promise<{
  legacyRoots: string[];
  devicesUpdated: number;
  sensorsUpdated: number;
  relaysUpdated: number;
}> {
  const pool = getPool();
  const currentRoot = installationMqttRoot();

  const deviceRows = await pool.query<{ id: string; mqtt_topic_prefix: string }>(
    `SELECT id, mqtt_topic_prefix FROM devices WHERE mqtt_topic_prefix IS NOT NULL AND mqtt_topic_prefix <> ''`
  );
  const sensorTopics = await pool.query<{ mqtt_state_topic: string }>(
    `SELECT mqtt_state_topic FROM sensors WHERE mqtt_state_topic IS NOT NULL AND mqtt_state_topic <> ''`
  );
  const bindingTopics = await pool.query<{ state_topic: string }>(
    `SELECT state_topic FROM capability_bindings WHERE state_topic IS NOT NULL AND state_topic <> ''`
  );
  const legacyRoots = detectLegacyInstallationRoots([
    ...deviceRows.rows.map((r) => r.mqtt_topic_prefix),
    ...sensorTopics.rows.map((r) => r.mqtt_state_topic),
    ...bindingTopics.rows.map((r) => r.state_topic),
  ]);

  if (legacyRoots.length === 0) {
    return { legacyRoots, devicesUpdated: 0, sensorsUpdated: 0, relaysUpdated: 0 };
  }

  let devicesUpdated = 0;
  let sensorsUpdated = 0;
  let relaysUpdated = 0;

  for (const row of deviceRows.rows) {
    const nextPrefix = remapTopicForLegacyRoots(
      row.mqtt_topic_prefix,
      currentRoot,
      legacyRoots
    );
    if (nextPrefix === row.mqtt_topic_prefix) continue;
    await pool.query(
      `UPDATE devices SET mqtt_topic_prefix = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [row.id, nextPrefix]
    );
    devicesUpdated += 1;
  }

  const sensors = await pool.query<{ id: string; mqtt_state_topic: string }>(
    `SELECT id, mqtt_state_topic FROM sensors WHERE mqtt_state_topic IS NOT NULL AND mqtt_state_topic <> ''`
  );
  for (const s of sensors.rows) {
    const next = remapTopicForLegacyRoots(s.mqtt_state_topic, currentRoot, legacyRoots);
    if (next === s.mqtt_state_topic) continue;
    await pool.query(`UPDATE sensors SET mqtt_state_topic = $2, updated_at = NOW() WHERE id = $1::uuid`, [
      s.id,
      next,
    ]);
    sensorsUpdated += 1;
  }

  const relays = await pool.query<{
    id: string;
    mqtt_state_topic: string;
    mqtt_command_topic: string;
  }>(
    `SELECT id, mqtt_state_topic, mqtt_command_topic FROM relays
     WHERE mqtt_state_topic IS NOT NULL AND mqtt_state_topic <> ''`
  );
  for (const r of relays.rows) {
    const nextState = remapTopicForLegacyRoots(r.mqtt_state_topic, currentRoot, legacyRoots);
    const nextCmd = remapTopicForLegacyRoots(r.mqtt_command_topic, currentRoot, legacyRoots);
    if (nextState === r.mqtt_state_topic && nextCmd === r.mqtt_command_topic) continue;
    await pool.query(
      `UPDATE relays SET mqtt_state_topic = $2, mqtt_command_topic = $3, updated_at = NOW() WHERE id = $1::uuid`,
      [r.id, nextState, nextCmd]
    );
    relaysUpdated += 1;
  }

  const bindings = await pool.query<{
    capability_id: string;
    state_topic: string;
    command_topic: string | null;
  }>(
    `SELECT capability_id, state_topic, command_topic FROM capability_bindings
     WHERE state_topic IS NOT NULL AND state_topic <> ''`
  );
  for (const b of bindings.rows) {
    const nextState = remapTopicForLegacyRoots(b.state_topic, currentRoot, legacyRoots);
    const nextCmd = b.command_topic
      ? remapTopicForLegacyRoots(b.command_topic, currentRoot, legacyRoots)
      : null;
    if (nextState === b.state_topic && nextCmd === b.command_topic) continue;
    await pool.query(
      `UPDATE capability_bindings
       SET state_topic = $2, command_topic = $3, updated_at = NOW()
       WHERE capability_id = $1::uuid`,
      [b.capability_id, nextState, nextCmd]
    );
  }

  return { legacyRoots, devicesUpdated, sensorsUpdated, relaysUpdated };
}

/**
 * Rebuild ESPHome sensor/relay MQTT topics from device prefix + entity id.
 * Skips Shelly and Octopus. Safe to run repeatedly.
 */
export async function normalizeEsphomeMqttTopics(): Promise<{
  sensorsUpdated: number;
  relaysUpdated: number;
}> {
  const pool = getPool();
  const sensors = await pool.query(
    `UPDATE sensors s
     SET mqtt_state_topic = d.mqtt_topic_prefix || '/sensor/' ||
           COALESCE(NULLIF(TRIM(s.esphome_entity_id), ''), s.slug) || '/state',
         updated_at = NOW()
     FROM devices d
     WHERE s.device_id = d.id
       AND COALESCE(d.firmware_type, 'esphome') NOT IN ('shelly', 'octopus', 'plugin')
       AND d.mqtt_topic_prefix IS NOT NULL AND d.mqtt_topic_prefix <> ''`
  );
  const relays = await pool.query(
    `UPDATE relays r
     SET mqtt_state_topic = d.mqtt_topic_prefix || '/switch/' ||
           COALESCE(NULLIF(TRIM(r.esphome_entity_id), ''), r.slug) || '/state',
         mqtt_command_topic = d.mqtt_topic_prefix || '/switch/' ||
           COALESCE(NULLIF(TRIM(r.esphome_entity_id), ''), r.slug) || '/command',
         updated_at = NOW()
     FROM devices d
     WHERE r.device_id = d.id
       AND COALESCE(d.firmware_type, 'esphome') NOT IN ('shelly', 'octopus', 'plugin')
       AND d.mqtt_topic_prefix IS NOT NULL AND d.mqtt_topic_prefix <> ''`
  );
  return {
    sensorsUpdated: sensors.rowCount ?? 0,
    relaysUpdated: relays.rowCount ?? 0,
  };
}

/** Force capability_bindings to match current sensors/relays MQTT topics. */
export async function repairCapabilityBindingsFromSources(): Promise<{
  sensors: number;
  relays: number;
}> {
  const pool = getPool();
  const sensors = await pool.query(
    `UPDATE capability_bindings b
     SET state_topic = s.mqtt_state_topic,
         command_topic = NULL,
         updated_at = NOW()
     FROM capabilities c
     JOIN sensors s ON c.source_type = 'sensor' AND s.id = c.source_id
     WHERE b.capability_id = c.id
       AND b.state_topic IS DISTINCT FROM s.mqtt_state_topic`
  );
  const relays = await pool.query(
    `UPDATE capability_bindings b
     SET state_topic = r.mqtt_state_topic,
         command_topic = r.mqtt_command_topic,
         updated_at = NOW()
     FROM capabilities c
     JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     WHERE b.capability_id = c.id
       AND (
         b.state_topic IS DISTINCT FROM r.mqtt_state_topic
         OR b.command_topic IS DISTINCT FROM r.mqtt_command_topic
       )`
  );
  return {
    sensors: sensors.rowCount ?? 0,
    relays: relays.rowCount ?? 0,
  };
}
