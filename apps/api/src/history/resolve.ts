import { getPool } from "../db.js";
import { resolveSensorEntityIdForHistory } from "./entity-id.js";

export type HistorySeriesTarget = {
  capabilityId: string;
  name: string;
  unit: string | null;
  deviceSlug: string;
  entityId: string;
  sourceType: string;
};

/**
 * Map capabilityId → Influx tags (device slug + entity_id) via sensors/relays.
 */
export async function resolveHistoryTarget(
  capabilityId: string
): Promise<
  | { ok: true; target: HistorySeriesTarget }
  | { ok: false; status: 404 | 400; message: string }
> {
  const pool = getPool();

  const cap = await pool.query<{
    id: string;
    name: string;
    unit: string | null;
    source_type: string;
    source_id: string;
    device_slug: string;
  }>(
    `SELECT c.id, COALESCE(NULLIF(c.custom_name, ''), c.name) AS name, c.unit, c.source_type, c.source_id, d.slug AS device_slug
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     WHERE c.id = $1
     LIMIT 1`,
    [capabilityId]
  );

  const row = cap.rows[0];
  if (!row) {
    return { ok: false, status: 404, message: "Capability not found" };
  }

  if (row.source_type === "sensor") {
    const sensor = await pool.query<{
      slug: string;
      esphome_entity_id: string | null;
      mqtt_state_topic: string | null;
      binding_state_topic: string | null;
    }>(
      `SELECT s.slug, s.esphome_entity_id, s.mqtt_state_topic, cb.state_topic AS binding_state_topic
       FROM sensors s
       LEFT JOIN capability_bindings cb ON cb.capability_id = $2
       WHERE s.id = $1
       LIMIT 1`,
      [row.source_id, row.id]
    );
    const s = sensor.rows[0];
    if (!s) {
      return {
        ok: false,
        status: 400,
        message: "Capability sensor source missing — run capability sync",
      };
    }
    const entityId = resolveSensorEntityIdForHistory({
      slug: s.slug,
      esphome_entity_id: s.esphome_entity_id,
      mqtt_state_topic: s.binding_state_topic || s.mqtt_state_topic,
    });
    return {
      ok: true,
      target: {
        capabilityId: row.id,
        name: row.name,
        unit: row.unit,
        deviceSlug: row.device_slug,
        entityId,
        sourceType: row.source_type,
      },
    };
  }

  if (row.source_type === "relay") {
    const relay = await pool.query<{
      slug: string;
      esphome_entity_id: string | null;
    }>(
      `SELECT slug, esphome_entity_id FROM relays WHERE id = $1 LIMIT 1`,
      [row.source_id]
    );
    const r = relay.rows[0];
    if (!r) {
      return {
        ok: false,
        status: 400,
        message: "Capability relay source missing — run capability sync",
      };
    }
    const entityId = r.esphome_entity_id || r.slug;
    return {
      ok: true,
      target: {
        capabilityId: row.id,
        name: row.name,
        unit: row.unit,
        deviceSlug: row.device_slug,
        entityId,
        sourceType: row.source_type,
      },
    };
  }

  return {
    ok: false,
    status: 400,
    message: `Cannot resolve Influx tags for source_type=${row.source_type}`,
  };
}
