import { getPool } from "../db.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import {
  buildShellyGen1RelayTopics,
  buildShellySwitchTopics,
  isShellyGen1MqttPrefix,
  normalizeShellyTopicPrefix,
  resolveShellyGen,
} from "./topics.js";

function relayChannelFromEntityId(entityId: string): number {
  const m = /^(?:switch|relay):(\d+)$/i.exec(entityId.trim());
  return m ? Math.max(0, parseInt(m[1]!, 10)) : 0;
}

/**
 * Fix Shelly Gen2/Gen3 devices imported with installation root as MQTT prefix.
 * Idempotent — only updates rows where prefix === MQTT_TOPIC_PREFIX and slug is device-native.
 */
export async function migrateShellyDevicePrefixes(): Promise<{
  devicesUpdated: number;
  relaysUpdated: number;
}> {
  const root = installationMqttRoot().toLowerCase();
  const pool = getPool();
  const devices = await pool.query<{
    id: string;
    slug: string;
    mqtt_topic_prefix: string;
  }>(
    `SELECT id, slug, mqtt_topic_prefix
     FROM devices
     WHERE COALESCE(firmware_type, 'esphome') = 'shelly'
       AND mqtt_topic_prefix IS NOT NULL AND mqtt_topic_prefix <> ''`
  );

  let devicesUpdated = 0;
  let relaysUpdated = 0;

  for (const device of devices.rows) {
    if (isShellyGen1MqttPrefix(device.mqtt_topic_prefix)) continue;
    const slug = device.slug.trim().toLowerCase();
    if (!/^shelly/i.test(slug)) continue;
    const prefix = normalizeShellyTopicPrefix(device.mqtt_topic_prefix).toLowerCase();
    if (prefix !== root) continue;

    const nextPrefix = slug;
    const shellyGen = resolveShellyGen(undefined, nextPrefix);
    await pool.query(
      `UPDATE devices SET mqtt_topic_prefix = $2, updated_at = NOW() WHERE id = $1::uuid`,
      [device.id, nextPrefix]
    );
    devicesUpdated += 1;

    const relays = await pool.query<{
      id: string;
      esphome_entity_id: string;
      capability_id: string | null;
    }>(
      `SELECT r.id, r.esphome_entity_id, c.id AS capability_id
       FROM relays r
       LEFT JOIN capabilities c ON c.source_type = 'relay' AND c.source_id = r.id
       WHERE r.device_id = $1::uuid`,
      [device.id]
    );

    for (const relay of relays.rows) {
      const ch = relayChannelFromEntityId(relay.esphome_entity_id || "switch:0");
      const topics =
        shellyGen === 1
          ? buildShellyGen1RelayTopics(nextPrefix, ch)
          : buildShellySwitchTopics(nextPrefix, ch);
      await pool.query(
        `UPDATE relays
         SET mqtt_state_topic = $2, mqtt_command_topic = $3,
             esphome_entity_id = $4, updated_at = NOW()
         WHERE id = $1::uuid`,
        [relay.id, topics.stateTopic, topics.commandTopic, topics.entityId]
      );
      relaysUpdated += 1;
      if (relay.capability_id) {
        await pool.query(
          `UPDATE capability_bindings
           SET state_topic = $2, command_topic = $3, updated_at = NOW()
           WHERE capability_id = $1::uuid`,
          [relay.capability_id, topics.stateTopic, topics.commandTopic]
        );
      }
    }
  }

  return { devicesUpdated, relaysUpdated };
}
