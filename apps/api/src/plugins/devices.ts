import { getPool } from "../db.js";
import { kindFromSensorType } from "../capabilities/kinds.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { writeSensorReading } from "../history/influx.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import { setLiveState } from "../telemetry/state-cache.js";
import { pushPluginEvent } from "./events.js";

/**
 * Plugin devices are stored like Octopus's: a devices row (firmware_type 'plugin') with sensors
 * and relays rows, so capabilities, panels, history and backups treat them like any device.
 * Readings arrive through the plugin doorway instead of MQTT.
 */
export const PLUGIN_FIRMWARE = "plugin";

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export type PluginItemDef = { key: string; name: string; kind: string; unit?: string | null; control?: boolean };
export type PluginDeviceDef = { key: string; name: string; items: PluginItemDef[] };

/** Plugin ids never contain "_", so "plugin_<id>_" cannot match another plugin's devices. */
export function pluginSlugPrefix(pluginId: string): string {
  return `plugin_${pluginId}_`;
}

export function pluginDeviceSlug(pluginId: string, deviceKey: string): string {
  return `${pluginSlugPrefix(pluginId)}${deviceKey}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseDeviceDefs(raw: unknown): { ok: true; devices: PluginDeviceDef[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "devices must be a list" };
  if (raw.length > 50) return { ok: false, error: "at most 50 devices per plugin" };
  const devices: PluginDeviceDef[] = [];
  const deviceKeys = new Set<string>();
  for (const d of raw) {
    if (!isRecord(d) || typeof d.key !== "string" || !KEY_RE.test(d.key)) {
      return { ok: false, error: "each device needs a key of lowercase letters, digits, _ or -" };
    }
    if (deviceKeys.has(d.key)) return { ok: false, error: `device key ${d.key} is listed twice` };
    deviceKeys.add(d.key);
    const name = typeof d.name === "string" && d.name.trim() ? d.name.trim().slice(0, 100) : d.key;
    if (!Array.isArray(d.items) || d.items.length > 100) {
      return { ok: false, error: `device ${d.key} needs an items list (at most 100)` };
    }
    const items: PluginItemDef[] = [];
    const itemKeys = new Set<string>();
    for (const it of d.items) {
      if (!isRecord(it) || typeof it.key !== "string" || !KEY_RE.test(it.key)) {
        return { ok: false, error: `each item of ${d.key} needs a key of lowercase letters, digits, _ or -` };
      }
      if (itemKeys.has(it.key)) return { ok: false, error: `item key ${it.key} is listed twice in ${d.key}` };
      itemKeys.add(it.key);
      const control = it.control === true;
      items.push({
        key: it.key,
        name: typeof it.name === "string" && it.name.trim() ? it.name.trim().slice(0, 100) : it.key,
        kind: control ? "switch" : typeof it.kind === "string" ? it.kind : "number",
        unit: typeof it.unit === "string" ? it.unit.slice(0, 20) : null,
        control,
      });
    }
    devices.push({ key: d.key, name, items });
  }
  return { ok: true, devices };
}

/** Replace the plugin's devices with this list (missing ones are removed). */
export async function definePluginDevices(pluginId: string, devices: PluginDeviceDef[]): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  const root = installationMqttRoot();
  try {
    await client.query("BEGIN");
    const keepSlugs: string[] = [];
    for (const dev of devices) {
      const slug = pluginDeviceSlug(pluginId, dev.key);
      keepSlugs.push(slug);
      const prefix = `${root}/${slug}`;
      const row = await client.query<{ id: string }>(
        `INSERT INTO devices (name, slug, mqtt_topic_prefix, firmware_type, is_enabled, is_online)
         VALUES ($1, $2, $3, '${PLUGIN_FIRMWARE}', TRUE, FALSE)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name, mqtt_topic_prefix = EXCLUDED.mqtt_topic_prefix,
           firmware_type = '${PLUGIN_FIRMWARE}', updated_at = NOW()
         RETURNING id`,
        [dev.name, slug, prefix]
      );
      const deviceId = row.rows[0]!.id;
      const sensorKeys = dev.items.filter((i) => !i.control).map((i) => i.key);
      const relayKeys = dev.items.filter((i) => i.control).map((i) => i.key);
      for (const item of dev.items) {
        if (item.control) {
          await client.query(
            `INSERT INTO relays (device_id, name, slug, mqtt_command_topic, mqtt_state_topic, esphome_entity_id)
             VALUES ($1, $2, $3, $4, $5, $3)
             ON CONFLICT (device_id, slug) DO UPDATE SET
               name = EXCLUDED.name, mqtt_command_topic = EXCLUDED.mqtt_command_topic,
               mqtt_state_topic = EXCLUDED.mqtt_state_topic, updated_at = NOW()`,
            [deviceId, item.name, item.key, `${prefix}/switch/${item.key}/command`, `${prefix}/switch/${item.key}/state`]
          );
        } else {
          await client.query(
            `INSERT INTO sensors (device_id, name, slug, sensor_type, unit, mqtt_state_topic, esphome_entity_id)
             VALUES ($1, $2, $3, $4, $5, $6, $3)
             ON CONFLICT (device_id, slug) DO UPDATE SET
               name = EXCLUDED.name, sensor_type = EXCLUDED.sensor_type, unit = EXCLUDED.unit,
               mqtt_state_topic = EXCLUDED.mqtt_state_topic, updated_at = NOW()`,
            [deviceId, item.name, item.key, kindFromSensorType(item.kind), item.unit ?? null, `${prefix}/sensor/${item.key}/state`]
          );
        }
      }
      // Items the plugin no longer lists.
      await client.query(
        `DELETE FROM capabilities c USING sensors s
         WHERE c.source_type = 'sensor' AND c.source_id = s.id AND s.device_id = $1 AND NOT (s.slug = ANY($2::text[]))`,
        [deviceId, sensorKeys]
      );
      await client.query(`DELETE FROM sensors WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`, [deviceId, sensorKeys]);
      await client.query(
        `DELETE FROM capabilities c USING relays r
         WHERE c.source_type = 'relay' AND c.source_id = r.id AND r.device_id = $1 AND NOT (r.slug = ANY($2::text[]))`,
        [deviceId, relayKeys]
      );
      await client.query(`DELETE FROM relays WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`, [deviceId, relayKeys]);
    }
    // Devices the plugin no longer lists (their items and capabilities go with them).
    await client.query(
      `DELETE FROM devices WHERE firmware_type = '${PLUGIN_FIRMWARE}' AND starts_with(slug, $1) AND NOT (slug = ANY($2::text[]))`,
      [pluginSlugPrefix(pluginId), keepSlugs]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await syncCapabilitiesFromLegacy();
  itemCache.delete(pluginId);
}

export async function removePluginDevices(pluginId: string): Promise<void> {
  await getPool().query(`DELETE FROM devices WHERE firmware_type = '${PLUGIN_FIRMWARE}' AND starts_with(slug, $1)`, [
    pluginSlugPrefix(pluginId),
  ]);
  itemCache.delete(pluginId);
}

export async function setPluginDevicesOnline(pluginId: string, online: boolean): Promise<void> {
  await getPool().query(
    `UPDATE devices SET mqtt_availability = $2 ${online ? ", last_seen_at = NOW()" : ""}
     WHERE firmware_type = '${PLUGIN_FIRMWARE}' AND starts_with(slug, $1)`,
    [pluginSlugPrefix(pluginId), online ? "online" : "offline"]
  );
}

type ItemRef = { capabilityId: string; deviceId: string; deviceSlug: string; kind: string; control: boolean };
const itemCache = new Map<string, Map<string, ItemRef>>();

async function pluginItems(pluginId: string): Promise<Map<string, ItemRef>> {
  const cached = itemCache.get(pluginId);
  if (cached) return cached;
  const res = await getPool().query<{
    id: string; device_id: string; device_slug: string; item_slug: string; kind: string; source_type: string;
  }>(
    `SELECT c.id, c.device_id, d.slug AS device_slug, COALESCE(s.slug, r.slug) AS item_slug, c.kind, c.source_type
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN sensors s ON c.source_type = 'sensor' AND s.id = c.source_id
     LEFT JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     WHERE d.firmware_type = '${PLUGIN_FIRMWARE}' AND starts_with(d.slug, $1)`,
    [pluginSlugPrefix(pluginId)]
  );
  const map = new Map<string, ItemRef>();
  const prefix = pluginSlugPrefix(pluginId);
  for (const row of res.rows) {
    const deviceKey = row.device_slug.slice(prefix.length);
    map.set(`${deviceKey}/${row.item_slug}`, {
      capabilityId: row.id,
      deviceId: row.device_id,
      deviceSlug: row.device_slug,
      kind: row.kind,
      control: row.source_type === "relay",
    });
  }
  itemCache.set(pluginId, map);
  return map;
}

const lastSeenWrite = new Map<string, number>();

/** Store readings for the plugin's own items. Returns the keys it did not recognise. */
export async function recordPluginReadings(
  pluginId: string,
  readings: { device: string; item: string; value: unknown }[]
): Promise<string[]> {
  const items = await pluginItems(pluginId);
  const unknown: string[] = [];
  const touchedDevices = new Set<string>();
  for (const r of readings) {
    const ref = items.get(`${r.device}/${r.item}`);
    if (!ref) {
      unknown.push(`${r.device}/${r.item}`);
      continue;
    }
    let value: unknown = r.value;
    if (ref.control) value = r.value === true || r.value === "on" || r.value === "ON";
    else if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) value = Number(value);
    if (!(typeof value === "number" && Number.isFinite(value)) && typeof value !== "boolean" && typeof value !== "string") {
      unknown.push(`${r.device}/${r.item}`);
      continue;
    }
    setLiveState(ref.capabilityId, value, { quality: "good" });
    if (typeof value === "number") {
      void writeSensorReading({ deviceSlug: ref.deviceSlug, entityId: r.item, value }).catch(() => {});
    }
    touchedDevices.add(ref.deviceId);
  }
  const now = Date.now();
  for (const deviceId of touchedDevices) {
    if (now - (lastSeenWrite.get(deviceId) ?? 0) < 30_000) continue;
    lastSeenWrite.set(deviceId, now);
    await getPool().query(
      `UPDATE devices SET mqtt_availability = 'online', last_seen_at = NOW() WHERE id = $1`,
      [deviceId]
    );
  }
  return unknown;
}

/** A person pressed one of the plugin's switches: hand it to the plugin. */
export async function sendPluginSwitchCommand(capabilityId: string, on: boolean): Promise<void> {
  const res = await getPool().query<{ device_slug: string; relay_slug: string; enabled: boolean | null; plugin_id: string | null }>(
    `SELECT d.slug AS device_slug, r.slug AS relay_slug, p.enabled, p.id AS plugin_id
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     LEFT JOIN installed_plugins p ON starts_with(d.slug, 'plugin_' || p.id || '_')
     WHERE c.id = $1
     LIMIT 1`,
    [capabilityId]
  );
  const row = res.rows[0];
  if (!row?.plugin_id) throw new Error("The plugin for this switch is not installed");
  if (!row.enabled) throw new Error("The plugin for this switch is switched off");
  const deviceKey = row.device_slug.slice(pluginSlugPrefix(row.plugin_id).length);
  pushPluginEvent(row.plugin_id, {
    type: "command",
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deviceKey,
    itemKey: row.relay_slug,
    action: on ? "on" : "off",
  });
}
