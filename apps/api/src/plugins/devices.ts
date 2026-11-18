import { getPool } from "../db.js";
import type { CapabilityRow } from "../capabilities/store.js";
import { kindFromSensorType } from "../capabilities/kinds.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { isControlType, parseControlFeatures, type ControlFeatures, type ControlType } from "../devices/controls.js";
import type { ItemSender } from "../devices/device-path.js";
import { devicePath } from "../devices/device-path-store.js";
import { pushPluginEvent } from "./events.js";

/**
 * Plugin devices are stored like any device: a devices row (connection 'extension', firmware_type
 * 'plugin') with sensors, relays and device_controls rows, so capabilities, panels, history and backups
 * treat them like any device. They have no MQTT addresses: readings arrive through the plugin doorway
 * and go into the shared device path, and presses go back to the plugin as events.
 */
export const PLUGIN_FIRMWARE = "plugin";

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export type PluginItemDef = {
  key: string;
  name: string;
  kind: string;
  unit?: string | null;
  /** A switch. */
  control?: boolean;
  /** More than on and off: heating, a light, air conditioning, with what it can do. */
  controlType?: ControlType;
  features?: ControlFeatures;
};
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
      if (isControlType(it.control)) {
        items.push({
          key: it.key,
          name: typeof it.name === "string" && it.name.trim() ? it.name.trim().slice(0, 100) : it.key,
          kind: it.control,
          controlType: it.control,
          features: parseControlFeatures(it.control, it.features),
        });
        continue;
      }
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
  try {
    await client.query("BEGIN");
    const keepSlugs: string[] = [];
    for (const dev of devices) {
      const slug = pluginDeviceSlug(pluginId, dev.key);
      keepSlugs.push(slug);
      const row = await client.query<{ id: string }>(
        `INSERT INTO devices (name, slug, firmware_type, is_enabled, is_online, connection)
         VALUES ($1, $2, '${PLUGIN_FIRMWARE}', TRUE, FALSE, 'extension')
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name, mqtt_topic_prefix = NULL,
           firmware_type = '${PLUGIN_FIRMWARE}', connection = 'extension', updated_at = NOW()
         RETURNING id`,
        [dev.name, slug]
      );
      const deviceId = row.rows[0]!.id;
      const sensorKeys = dev.items.filter((i) => !i.control && !i.controlType).map((i) => i.key);
      const relayKeys = dev.items.filter((i) => i.control).map((i) => i.key);
      const controlKeys = dev.items.filter((i) => i.controlType).map((i) => i.key);
      for (const item of dev.items) {
        if (item.controlType) {
          await client.query(
            `INSERT INTO device_controls (device_id, name, slug, control_type, features)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (device_id, slug) DO UPDATE SET
               name = EXCLUDED.name, control_type = EXCLUDED.control_type, features = EXCLUDED.features,
               command_topic = NULL, state_topic = NULL, updated_at = NOW()`,
            [deviceId, item.name, item.key, item.controlType, JSON.stringify(item.features ?? {})]
          );
        } else if (item.control) {
          await client.query(
            `INSERT INTO relays (device_id, name, slug, esphome_entity_id)
             VALUES ($1, $2, $3, $3)
             ON CONFLICT (device_id, slug) DO UPDATE SET
               name = EXCLUDED.name, mqtt_command_topic = NULL, mqtt_state_topic = NULL, updated_at = NOW()`,
            [deviceId, item.name, item.key]
          );
        } else {
          await client.query(
            `INSERT INTO sensors (device_id, name, slug, sensor_type, unit, esphome_entity_id)
             VALUES ($1, $2, $3, $4, $5, $3)
             ON CONFLICT (device_id, slug) DO UPDATE SET
               name = EXCLUDED.name, sensor_type = EXCLUDED.sensor_type, unit = EXCLUDED.unit,
               mqtt_state_topic = NULL, updated_at = NOW()`,
            [deviceId, item.name, item.key, kindFromSensorType(item.kind), item.unit ?? null]
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
      await client.query(`DELETE FROM device_controls WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`, [deviceId, controlKeys]);
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

/** The plugin stopped: its devices are offline and their values no longer current. */
export async function pluginDevicesOffline(pluginId: string): Promise<void> {
  const res = await getPool().query<{ id: string }>(
    `SELECT id FROM devices WHERE firmware_type = '${PLUGIN_FIRMWARE}' AND starts_with(slug, $1)`,
    [pluginSlugPrefix(pluginId)]
  );
  devicePath.deviceOffline(res.rows.map((r) => r.id));
}

type ItemRef = { capabilityId: string; deviceId: string; deviceSlug: string; kind: string; control: boolean; deviceControl: boolean };
const itemCache = new Map<string, Map<string, ItemRef>>();

async function pluginItems(pluginId: string): Promise<Map<string, ItemRef>> {
  const cached = itemCache.get(pluginId);
  if (cached) return cached;
  const res = await getPool().query<{
    id: string; device_id: string; device_slug: string; item_slug: string; kind: string; source_type: string;
  }>(
    `SELECT c.id, c.device_id, d.slug AS device_slug, COALESCE(s.slug, r.slug, dc.slug) AS item_slug, c.kind, c.source_type
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN sensors s ON c.source_type = 'sensor' AND s.id = c.source_id
     LEFT JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     LEFT JOIN device_controls dc ON c.source_type = 'control' AND dc.id = c.source_id
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
      deviceControl: row.source_type === "control",
    });
  }
  itemCache.set(pluginId, map);
  return map;
}

/** Hand readings for the plugin's own items to the device path. Returns the keys it did not recognise. */
export async function recordPluginReadings(
  pluginId: string,
  readings: { device: string; item: string; value: unknown }[]
): Promise<string[]> {
  const items = await pluginItems(pluginId);
  const unknown: string[] = [];
  for (const r of readings) {
    const ref = items.get(`${r.device}/${r.item}`);
    if (!ref) {
      unknown.push(`${r.device}/${r.item}`);
      continue;
    }
    if (ref.deviceControl) {
      if (!devicePath.reportControl(ref.capabilityId, r.value)) unknown.push(`${r.device}/${r.item}`);
      continue;
    }
    let value: unknown = r.value;
    if (ref.control) value = r.value === true || r.value === "on" || r.value === "ON";
    else if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) value = Number(value);
    if (!(typeof value === "number" && Number.isFinite(value)) && typeof value !== "boolean" && typeof value !== "string") {
      unknown.push(`${r.device}/${r.item}`);
      continue;
    }
    devicePath.reportItem(ref.capabilityId, value, {
      kind: ref.control ? "switch" : ref.kind,
      retained: false,
      history: ref.control ? null : { deviceSlug: ref.deviceSlug, entityId: r.item },
    });
  }
  return unknown;
}

/** The plugin that reaches this item, and the item's keys within it. */
async function pluginOf(item: CapabilityRow): Promise<{ pluginId: string; deviceKey: string; itemKey: string }> {
  const res = await getPool().query<{ device_slug: string; item_slug: string | null; enabled: boolean | null; plugin_id: string | null }>(
    `SELECT d.slug AS device_slug, COALESCE(r.slug, dc.slug) AS item_slug, p.enabled, p.id AS plugin_id
     FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     LEFT JOIN relays r ON c.source_type = 'relay' AND r.id = c.source_id
     LEFT JOIN device_controls dc ON c.source_type = 'control' AND dc.id = c.source_id
     LEFT JOIN installed_plugins p ON starts_with(d.slug, 'plugin_' || p.id || '_')
     WHERE c.id = $1
     LIMIT 1`,
    [item.id]
  );
  const row = res.rows[0];
  if (!row?.plugin_id || !row.item_slug) throw new Error("The extension for this device is not installed");
  if (!row.enabled) throw new Error("The extension for this device is switched off");
  return { pluginId: row.plugin_id, deviceKey: row.device_slug.slice(pluginSlugPrefix(row.plugin_id).length), itemKey: row.item_slug };
}

const commandId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * How a press or change reaches a plugin: as an event it collects. The plugin reports the new state
 * with sendReading, and only that report counts (see the device path).
 */
export const extensionSender: ItemSender = {
  unavailable: () => null,
  async send(item, on) {
    const { pluginId, deviceKey, itemKey } = await pluginOf(item);
    pushPluginEvent(pluginId, { type: "command", id: commandId(), deviceKey, itemKey, action: on ? "on" : "off" });
  },
  async sendControl(item, change) {
    const { pluginId, deviceKey, itemKey } = await pluginOf(item);
    pushPluginEvent(pluginId, {
      type: "command",
      id: commandId(),
      deviceKey,
      itemKey,
      action: "set",
      values: change as Record<string, unknown>,
    });
  },
};
