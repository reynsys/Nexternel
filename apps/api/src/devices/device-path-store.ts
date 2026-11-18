/**
 * The device path (device-path.ts) wired to this server: the database, history, the Activity log,
 * and each connection's way of sending a press. Everything else uses `devicePath` from here.
 */
import { logActivity, logSensorAnswer, logSwitchChange, noteSwitchCommand } from "../activity/activity.js";
import { getCapabilityById } from "../capabilities/store.js";
import { getPool } from "../db.js";
import { writeSensorReading } from "../history/influx.js";
import { isControlType, type ControlFeatures } from "./controls.js";
import { createDevicePath, type Connection, type ControlInfo, type ItemSender } from "./device-path.js";

const ignore = () => {
  /* best-effort: the next report puts it right */
};

async function sender(connection: Connection): Promise<ItemSender> {
  switch (connection) {
    case "mqtt":
      return (await import("../telemetry/mqtt.js")).mqttItemSender;
    case "zherodius":
      return (await import("../zherodius/service.js")).zherodius.sender;
    case "extension":
      return (await import("../plugins/devices.js")).extensionSender;
    default:
      return noSender;
  }
}

/** A connection with nothing to switch (Octopus), or one not built yet. */
const noSender: ItemSender = {
  unavailable: () => "Nexternel has no way to switch this device",
  send: () => Promise.reject(new Error("Nexternel has no way to switch this device")),
};

async function getControl(itemId: string): Promise<ControlInfo | null> {
  const r = await getPool().query<{ kind: string; features: ControlFeatures }>(
    `SELECT c.kind, dc.features FROM capabilities c
     JOIN device_controls dc ON c.source_type = 'control' AND dc.id = c.source_id
     WHERE c.id = $1`,
    [itemId]
  );
  const row = r.rows[0];
  return row && isControlType(row.kind) ? { type: row.kind, features: row.features ?? {} } : null;
}

let exemptCache: Set<string> | null = null;
let exemptCacheAt = 0;

/** The Octopus meter is read on its own poll schedule; its readings are not aged out here. */
async function itemsExemptFromFreshness(): Promise<Set<string>> {
  const now = Date.now();
  if (exemptCache && now - exemptCacheAt < 60_000) return exemptCache;
  try {
    const r = await getPool().query<{ id: string }>(
      `SELECT c.id FROM capabilities c JOIN devices d ON d.id = c.device_id WHERE d.connection = 'octopus'`
    );
    exemptCache = new Set(r.rows.map((row) => row.id));
    exemptCacheAt = now;
    return exemptCache;
  } catch {
    return exemptCache ?? new Set();
  }
}

export const devicePath = createDevicePath({
  getItem: getCapabilityById,
  sender,
  getControl,
  touchDeviceOfItem(itemId) {
    void getPool()
      .query(
        `UPDATE devices d SET availability = 'online', last_seen_at = NOW()
         FROM capabilities c WHERE c.id = $1 AND c.device_id = d.id`,
        [itemId]
      )
      .catch(ignore);
  },
  setDevicesOnline(deviceIds, online) {
    void getPool()
      .query(
        online
          ? `UPDATE devices SET availability = 'online', last_seen_at = NOW() WHERE id = ANY($1::uuid[])`
          : `UPDATE devices SET availability = 'offline' WHERE id = ANY($1::uuid[])`,
        [deviceIds]
      )
      .catch(ignore);
    void import("../esphome/lifecycle.js").then((m) => m.syncEsphomeLifecycle(deviceIds, online)).catch(ignore);
  },
  async itemsToStaleOnOffline(deviceIds) {
    const r = await getPool().query<{ id: string }>(
      `SELECT c.id FROM capabilities c JOIN devices d ON d.id = c.device_id
       WHERE d.id = ANY($1::uuid[])`,
      [deviceIds]
    );
    return r.rows.map((row) => row.id);
  },
  itemsExemptFromFreshness,
  saveSwitchPosition(itemId, on) {
    void getPool()
      .query(
        `UPDATE relays r SET last_state = $1, updated_at = NOW()
         FROM capabilities c WHERE c.id = $2 AND c.source_type = 'relay' AND r.id = c.source_id`,
        [on ? "ON" : "OFF", itemId]
      )
      .catch(ignore);
  },
  writeHistory(key, value) {
    // History is best-effort; the live value still works.
    void writeSensorReading({ deviceSlug: key.deviceSlug, entityId: key.entityId, value }).catch(ignore);
  },
  logSwitchChange: (itemId, on) => void logSwitchChange(itemId, on),
  logSensorAnswer: (itemId, answering) => void logSensorAnswer(itemId, answering),
  noteSwitchCommand,
  logActivity: (entry) => void logActivity(entry),
  now: () => Date.now(),
});
