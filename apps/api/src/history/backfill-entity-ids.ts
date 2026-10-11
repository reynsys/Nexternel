import { getPool } from "../db.js";
import { resolveSensorEntityIdForHistory } from "./entity-id.js";

/**
 * Align sensors.esphome_entity_id with the MQTT topic segment used in InfluxDB.
 * Device Builder stores hyphenated slugs; ESPHome/Influx use underscore entity ids.
 */
export async function backfillSensorEntityIdsFromMqttTopics(): Promise<number> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    slug: string;
    esphome_entity_id: string | null;
    mqtt_state_topic: string | null;
    binding_state_topic: string | null;
  }>(
    `SELECT DISTINCT ON (s.id) s.id, s.slug, s.esphome_entity_id, s.mqtt_state_topic,
            cb.state_topic AS binding_state_topic
     FROM sensors s
     LEFT JOIN capabilities c ON c.source_type = 'sensor' AND c.source_id = s.id
     LEFT JOIN capability_bindings cb ON cb.capability_id = c.id
     WHERE COALESCE(cb.state_topic, s.mqtt_state_topic) IS NOT NULL
       AND COALESCE(cb.state_topic, s.mqtt_state_topic) <> ''
     ORDER BY s.id, cb.updated_at DESC NULLS LAST`
  );

  let updated = 0;
  for (const row of res.rows) {
    const resolved = resolveSensorEntityIdForHistory({
      slug: row.slug,
      esphome_entity_id: row.esphome_entity_id,
      mqtt_state_topic: row.binding_state_topic || row.mqtt_state_topic,
    });
    const current = row.esphome_entity_id?.trim() || "";
    if (!resolved || resolved === current) continue;
    const result = await pool.query(
      `UPDATE sensors SET esphome_entity_id = $2, updated_at = NOW()
       WHERE id = $1 AND (esphome_entity_id IS NULL OR esphome_entity_id IS DISTINCT FROM $2)`,
      [row.id, resolved]
    );
    updated += result.rowCount ?? 0;
  }
  return updated;
}
