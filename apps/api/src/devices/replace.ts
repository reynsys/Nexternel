/**
 * A new device replaces an old one (for example a board moved from ESPHome to Zherodius, or a broken
 * switch swapped): the old device's items keep their identity and are joined to the new device's
 * switches and readings, so everything that used them (panels, the names and icons people gave them,
 * status-light limits, extension permissions) goes on working. Then the old device is removed.
 */
import { logActivity } from "../activity/activity.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { getPool } from "../db.js";
import type { Connection } from "./device-path.js";

export type ReplaceItem = { id: string; name: string; kind: string };

/** Old items matched to new ones: same kind and the same name the device gives it (letter case aside). */
export function matchItems(oldItems: ReplaceItem[], newItems: ReplaceItem[]) {
  const key = (i: ReplaceItem) => `${i.kind}\u0000${i.name.trim().toLowerCase()}`;
  const free = new Map<string, ReplaceItem[]>();
  for (const n of newItems) free.set(key(n), [...(free.get(key(n)) ?? []), n]);
  const moves: { from: ReplaceItem; to: ReplaceItem }[] = [];
  const missing: ReplaceItem[] = [];
  for (const o of oldItems) {
    const hit = free.get(key(o))?.shift();
    if (hit) moves.push({ from: o, to: hit });
    else missing.push(o);
  }
  return { moves, missing };
}

export type ReplaceCandidate = {
  deviceId: string;
  name: string;
  firmwareType: string;
  connection: Connection;
  online: boolean;
  /** Items of the old device that the new one has too (they keep their panels and names). */
  moved: { name: string; kind: string }[];
  /** Items of the old device the new one does not have: they go with the old device. */
  missing: { name: string; kind: string }[];
};

async function itemsOfDevice(deviceId: string): Promise<ReplaceItem[]> {
  const r = await getPool().query<ReplaceItem>(`SELECT id, name, kind FROM capabilities WHERE device_id = $1 ORDER BY name`, [deviceId]);
  return r.rows;
}

/** Devices this new device may replace: other devices with the same name. */
export async function replaceCandidates(newDeviceId: string): Promise<ReplaceCandidate[]> {
  const r = await getPool().query<{ id: string; name: string; firmware_type: string; connection: Connection; availability: string }>(
    `SELECT o.id, o.name, COALESCE(o.firmware_type, 'esphome') AS firmware_type, o.connection, o.availability
     FROM devices o JOIN devices n ON n.id = $1
     WHERE o.id <> n.id AND LOWER(TRIM(o.name)) = LOWER(TRIM(n.name))
     ORDER BY o.created_at`,
    [newDeviceId]
  );
  if (!r.rows.length) return [];
  const newItems = await itemsOfDevice(newDeviceId);
  const out: ReplaceCandidate[] = [];
  for (const o of r.rows) {
    const { moves, missing } = matchItems(await itemsOfDevice(o.id), newItems);
    out.push({
      deviceId: o.id,
      name: o.name,
      firmwareType: o.firmware_type,
      connection: o.connection,
      online: o.availability === "online",
      moved: moves.map((m) => ({ name: m.from.name, kind: m.from.kind })),
      missing: missing.map((m) => ({ name: m.name, kind: m.kind })),
    });
  }
  return out;
}

export class ReplaceRefusedError extends Error {}

/** The new device replaces the old one. Gives how many items moved. */
export async function replaceDevice(newDeviceId: string, oldDeviceId: string): Promise<{ moved: number; removed: number }> {
  if (newDeviceId === oldDeviceId) throw new ReplaceRefusedError("A device cannot replace itself.");
  const both = await getPool().query<{ id: string; name: string; room_id: string | null; connection: Connection }>(
    `SELECT id, name, room_id, connection FROM devices WHERE id = ANY($1::uuid[])`,
    [[newDeviceId, oldDeviceId]]
  );
  const fresh = both.rows.find((d) => d.id === newDeviceId);
  const old = both.rows.find((d) => d.id === oldDeviceId);
  if (!fresh || !old) throw new ReplaceRefusedError("One of the two devices is no longer there.");

  const { moves, missing } = matchItems(await itemsOfDevice(oldDeviceId), await itemsOfDevice(newDeviceId));
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const { from, to } of moves) {
      // The new item's switch or reading goes to the old item, which keeps its id (and so its panels).
      const n = await client.query<{ source_type: string; source_id: string; kind: string; unit: string | null; name: string }>(
        `DELETE FROM capabilities WHERE id = $1 RETURNING source_type, source_id, kind, unit, name`,
        [to.id]
      );
      const src = n.rows[0];
      if (!src) continue;
      await client.query(
        `UPDATE capabilities SET device_id = $2, source_type = $3, source_id = $4, kind = $5, unit = $6, name = $7, updated_at = NOW()
         WHERE id = $1`,
        [from.id, newDeviceId, src.source_type, src.source_id, src.kind, src.unit, src.name]
      );
    }
    // The area: the one chosen for the new device, or else the old device's.
    await client.query(`UPDATE devices SET room_id = COALESCE(room_id, $2), updated_at = NOW() WHERE id = $1`, [newDeviceId, old.room_id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { deleteDevice } = await import("./service.js");
  await deleteDevice(oldDeviceId, { deleteYaml: false });
  await syncCapabilitiesFromLegacy();
  try {
    const { refreshTelemetrySubscriptions } = await import("../telemetry/mqtt.js");
    await refreshTelemetrySubscriptions();
  } catch {
    /* telemetry not running */
  }
  if (fresh.connection === "zherodius") {
    const { zherodius } = await import("../zherodius/service.js");
    await zherodius.refreshItems(newDeviceId);
  }
  void logActivity({
    kind: "device",
    deviceId: newDeviceId,
    text: `${fresh.name} replaced the earlier ${old.name}: ${moves.length === 1 ? "1 item kept its" : `${moves.length} items kept their`} panels and names${missing.length ? `, ${missing.length} removed with the earlier device` : ""}`,
  });
  return { moved: moves.length, removed: missing.length };
}
