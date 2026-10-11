import { getPool } from "../db.js";
import { kindFromSensorType } from "./kinds.js";
import { alignInstallationMqttTopics, normalizeEsphomeMqttTopics, repairCapabilityBindingsFromSources } from "../migrate/align-mqtt-topics.js";
import { migrateShellyDevicePrefixes } from "../shelly/migrate-prefixes.js";

/**
 * Upsert capabilities + bindings from sensors / relays tables.
 * Safe to run repeatedly (idempotent on source_type + source_id).
 */
export async function syncCapabilitiesFromLegacy(): Promise<{
  sensors: number;
  relays: number;
  topicAlignment: Awaited<ReturnType<typeof alignInstallationMqttTopics>>;
  topicNormalization: Awaited<ReturnType<typeof normalizeEsphomeMqttTopics>>;
  shellyPrefixMigration: Awaited<ReturnType<typeof migrateShellyDevicePrefixes>>;
  bindingRepair: Awaited<ReturnType<typeof repairCapabilityBindingsFromSources>>;
}> {
  const topicAlignment = await alignInstallationMqttTopics();
  const topicNormalization = await normalizeEsphomeMqttTopics();
  const shellyPrefixMigration = await migrateShellyDevicePrefixes();
  const bindingRepair = await repairCapabilityBindingsFromSources();
  if (shellyPrefixMigration.devicesUpdated > 0) {
    try {
      const { refreshTelemetrySubscriptions } = await import("../telemetry/mqtt.js");
      await refreshTelemetrySubscriptions();
    } catch {
      /* telemetry may not be started yet during bootstrap */
    }
  }
  const pool = getPool();

  const sensors = await pool.query<{
    id: string;
    device_id: string;
    name: string;
    sensor_type: string;
    unit: string | null;
    mqtt_state_topic: string;
    is_enabled: boolean;
  }>(
    `SELECT id, device_id, name, sensor_type, unit, mqtt_state_topic,
            COALESCE(is_enabled, TRUE) AS is_enabled
     FROM sensors`
  );

  let sensorCount = 0;
  for (const s of sensors.rows) {
    const kind = kindFromSensorType(s.sensor_type);
    const cap = await pool.query<{ id: string }>(
      `INSERT INTO capabilities (device_id, kind, name, unit, source_type, source_id, is_enabled)
       VALUES ($1, $2, $3, $4, 'sensor', $5, $6)
       ON CONFLICT (source_type, source_id) DO UPDATE SET
         device_id = EXCLUDED.device_id,
         kind = EXCLUDED.kind,
         name = EXCLUDED.name,
         unit = EXCLUDED.unit,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING id`,
      [s.device_id, kind, s.name, s.unit, s.id, s.is_enabled]
    );
    const capabilityId = cap.rows[0].id;
    await pool.query(
      `INSERT INTO capability_bindings (capability_id, protocol, state_topic, command_topic)
       VALUES ($1, 'mqtt', $2, NULL)
       ON CONFLICT (capability_id) DO UPDATE SET
         state_topic = EXCLUDED.state_topic,
         command_topic = NULL,
         updated_at = NOW()`,
      [capabilityId, s.mqtt_state_topic]
    );
    sensorCount += 1;
  }

  const relays = await pool.query<{
    id: string;
    device_id: string;
    name: string;
    mqtt_state_topic: string;
    mqtt_command_topic: string;
    is_enabled: boolean;
  }>(
    `SELECT id, device_id, name, mqtt_state_topic, mqtt_command_topic,
            COALESCE(is_enabled, TRUE) AS is_enabled
     FROM relays`
  );

  let relayCount = 0;
  for (const r of relays.rows) {
    const cap = await pool.query<{ id: string }>(
      `INSERT INTO capabilities (device_id, kind, name, unit, source_type, source_id, is_enabled)
       VALUES ($1, 'switch', $2, NULL, 'relay', $3, $4)
       ON CONFLICT (source_type, source_id) DO UPDATE SET
         device_id = EXCLUDED.device_id,
         kind = 'switch',
         name = EXCLUDED.name,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()
       RETURNING id`,
      [r.device_id, r.name, r.id, r.is_enabled]
    );
    const capabilityId = cap.rows[0].id;
    await pool.query(
      `INSERT INTO capability_bindings (capability_id, protocol, state_topic, command_topic)
       VALUES ($1, 'mqtt', $2, $3)
       ON CONFLICT (capability_id) DO UPDATE SET
         state_topic = EXCLUDED.state_topic,
         command_topic = EXCLUDED.command_topic,
         updated_at = NOW()`,
      [capabilityId, r.mqtt_state_topic, r.mqtt_command_topic]
    );
    relayCount += 1;
  }

  await pool.query(
    `DELETE FROM capabilities c
     WHERE c.source_type = 'sensor'
       AND NOT EXISTS (SELECT 1 FROM sensors s WHERE s.id = c.source_id)`
  );
  await pool.query(
    `DELETE FROM capabilities c
     WHERE c.source_type = 'relay'
       AND NOT EXISTS (SELECT 1 FROM relays r WHERE r.id = c.source_id)`
  );

  const { pruneInternalRelayRows } = await import("./cleanup.js");
  await pruneInternalRelayRows();

  const { assignStarterIcons } = await import("./settings.js");
  await assignStarterIcons();

  const { syncCapabilityAreasFromDevices, classifyAllCapabilities } = await import(
    "./classify.js"
  );
  const { backfillSensorEntityIdsFromMqttTopics } = await import(
    "../history/backfill-entity-ids.js"
  );
  await backfillSensorEntityIdsFromMqttTopics();
  await syncCapabilityAreasFromDevices();
  await classifyAllCapabilities();

  try {
    const { refreshTelemetrySubscriptions } = await import("../telemetry/mqtt.js");
    await refreshTelemetrySubscriptions();
  } catch {
    /* telemetry may not be started yet during bootstrap */
  }

  return {
    sensors: sensorCount,
    relays: relayCount,
    topicAlignment,
    topicNormalization,
    shellyPrefixMigration,
    bindingRepair,
  };
}
