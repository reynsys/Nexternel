/**
 * What Nexternel keeps for its Zherodius devices: its own long-term key for the direct line (one per
 * home, made the first time it is needed), and per paired device the device's key (pinned at pairing),
 * its serial number and its address. The devices and their items are ordinary devices, relays and sensors.
 */
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { getPool } from "../db.js";
import { askLocalName } from "../home-network/local-name.js";
import type { RawSearch } from "../home-network/classify.js";
import type { ZherodiusBackup } from "../backup/types.js";
import type { Pairing } from "./connections.js";
import { planItems, type ItemMap } from "./items.js";
import { hex, unhex, x25519Key, type X25519Key } from "./line-crypto.js";
import type { DeviceInfo, Hello } from "./line.js";

export const ZHERODIUS_FIRMWARE = "zherodius";

export async function ensureZherodiusSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS zherodius_hub (
      id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      private_key TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS zherodius_pairings (
      device_id   UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
      serial      TEXT NOT NULL UNIQUE,
      address     TEXT NOT NULL,
      device_key  TEXT NOT NULL,
      version     TEXT,
      cfg         BIGINT,
      paired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- The name Nexternel gave itself when pairing (the device lists it as "Unpair <name>").
    ALTER TABLE zherodius_pairings ADD COLUMN IF NOT EXISTS hub_name TEXT;
    -- The newest version the owner was told about (the bell says so once per version).
    ALTER TABLE zherodius_pairings ADD COLUMN IF NOT EXISTS update_told TEXT;
  `);
}

let hubCache: X25519Key | null = null;

/** This home's long-term key for the direct line (the devices know its public half). */
export async function hubKey(): Promise<X25519Key> {
  if (hubCache) return hubCache;
  const made = x25519Key();
  // Made once; a second caller at the same moment gets the one that was stored first.
  await getPool().query(`INSERT INTO zherodius_hub (id, private_key) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`, [hex(made.priv)]);
  const r = await getPool().query<{ private_key: string }>(`SELECT private_key FROM zherodius_hub WHERE id = 1`);
  hubCache = x25519Key(unhex(r.rows[0]!.private_key));
  return hubCache;
}

/** Forget the cached key (a restore put another one in place). */
export function forgetHubKeyCache(): void {
  hubCache = null;
}

type PairingRow = { device_id: string; name: string; slug: string; serial: string; address: string; device_key: string; cfg: string | null; hub_name: string | null };

function toPairing(r: PairingRow): Pairing {
  return { deviceId: r.device_id, deviceName: r.name, deviceSlug: r.slug, serial: r.serial, address: r.address, deviceKey: r.device_key, cfg: r.cfg === null ? null : Number(r.cfg), hubName: r.hub_name };
}

const PAIRING_SELECT = `SELECT p.device_id, d.name, d.slug, p.serial, p.address, p.device_key, p.cfg, p.hub_name
  FROM zherodius_pairings p JOIN devices d ON d.id = p.device_id`;

export async function listPairings(): Promise<Pairing[]> {
  const r = await getPool().query<PairingRow>(`${PAIRING_SELECT} WHERE d.connection = 'zherodius' AND COALESCE(d.is_enabled, TRUE)`);
  return r.rows.map(toPairing);
}

export async function getPairing(deviceId: string): Promise<Pairing | null> {
  const r = await getPool().query<PairingRow>(`${PAIRING_SELECT} WHERE p.device_id = $1`, [deviceId]);
  return r.rows[0] ? toPairing(r.rows[0]) : null;
}

/** The device's items, by slug (relay_1, sensor_3_t …). */
export async function itemsOf(deviceId: string): Promise<ItemMap> {
  const r = await getPool().query<{ slug: string; id: string; kind: string }>(
    `SELECT r.slug, c.id, c.kind FROM relays r JOIN capabilities c ON c.source_type = 'relay' AND c.source_id = r.id WHERE r.device_id = $1
     UNION ALL
     SELECT s.slug, c.id, c.kind FROM sensors s JOIN capabilities c ON c.source_type = 'sensor' AND c.source_id = s.id WHERE s.device_id = $1
     UNION ALL
     SELECT dc.slug, c.id, c.kind FROM device_controls dc JOIN capabilities c ON c.source_type = 'control' AND c.source_id = dc.id WHERE dc.device_id = $1`,
    [deviceId]
  );
  return new Map(r.rows.map((row) => [row.slug, { itemId: row.id, kind: row.kind }]));
}

/**
 * Make the device's relays, sensors and lights match what it says it is made of: new parts are added,
 * renamed ones renamed, removed ones removed (names a person gave items in Nexternel stay).
 */
export async function syncItems(deviceId: string, info: DeviceInfo): Promise<ItemMap> {
  const plan = planItems(info);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const item of plan) {
      if (item.kind === "control") {
        await client.query(
          `INSERT INTO device_controls (device_id, name, slug, control_type, features) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (device_id, slug) DO UPDATE SET name = EXCLUDED.name, control_type = EXCLUDED.control_type, features = EXCLUDED.features,
             command_topic = NULL, state_topic = NULL, updated_at = NOW()`,
          [deviceId, item.name, item.slug, item.controlType, JSON.stringify(item.features)]
        );
      } else if (item.kind === "relay") {
        await client.query(
          `INSERT INTO relays (device_id, name, slug, esphome_entity_id) VALUES ($1, $2, $3, $3)
           ON CONFLICT (device_id, slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
          [deviceId, item.name, item.slug]
        );
      } else {
        await client.query(
          `INSERT INTO sensors (device_id, name, slug, sensor_type, unit, esphome_entity_id) VALUES ($1, $2, $3, $4, $5, $3)
           ON CONFLICT (device_id, slug) DO UPDATE SET name = EXCLUDED.name, sensor_type = EXCLUDED.sensor_type, unit = EXCLUDED.unit, updated_at = NOW()`,
          [deviceId, item.name, item.slug, item.sensorType, item.unit]
        );
      }
    }
    const relaySlugs = plan.filter((p) => p.kind === "relay").map((p) => p.slug);
    const sensorSlugs = plan.filter((p) => p.kind === "sensor").map((p) => p.slug);
    const controlSlugs = plan.filter((p) => p.kind === "control").map((p) => p.slug);
    await client.query(
      `DELETE FROM capabilities c USING device_controls dc
       WHERE c.source_type = 'control' AND c.source_id = dc.id AND dc.device_id = $1 AND NOT (dc.slug = ANY($2::text[]))`,
      [deviceId, controlSlugs]
    );
    await client.query(`DELETE FROM device_controls WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`, [deviceId, controlSlugs]);
    await client.query(
      `DELETE FROM capabilities c USING relays r
       WHERE c.source_type = 'relay' AND c.source_id = r.id AND r.device_id = $1 AND NOT (r.slug = ANY($2::text[]))`,
      [deviceId, relaySlugs]
    );
    await client.query(`DELETE FROM relays WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`, [deviceId, relaySlugs]);
    await client.query(
      `DELETE FROM capabilities c USING sensors s
       WHERE c.source_type = 'sensor' AND c.source_id = s.id AND s.device_id = $1 AND NOT (s.slug = ANY($2::text[]))`,
      [deviceId, sensorSlugs]
    );
    await client.query(`DELETE FROM sensors WHERE device_id = $1 AND NOT (slug = ANY($2::text[]))`, [deviceId, sensorSlugs]);
    if (info.mac) await client.query(`UPDATE devices SET mac_address = $2, updated_at = NOW() WHERE id = $1`, [deviceId, info.mac]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await syncCapabilitiesFromLegacy();
  return itemsOf(deviceId);
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export function saveSeen(deviceId: string, seen: { address: string; cfg: number | null; version: string }): void {
  void getPool()
    .query(`UPDATE zherodius_pairings SET address = $2, cfg = $3, version = $4 WHERE device_id = $1`, [deviceId, seen.address, seen.cfg, seen.version])
    .catch(() => undefined);
  if (IPV4.test(seen.address)) {
    void getPool()
      .query(`UPDATE devices SET ip_address = $2::inet WHERE id = $1 AND ip_address IS DISTINCT FROM $2::inet`, [deviceId, seen.address])
      .catch(() => undefined);
  }
}

/** The Zherodius devices with the version each runs (as last seen), by name. */
export async function listVersions(): Promise<{ deviceId: string; name: string; version: string | null }[]> {
  const r = await getPool().query<{ device_id: string; name: string; version: string | null }>(
    `SELECT p.device_id, d.name, p.version FROM zherodius_pairings p JOIN devices d ON d.id = p.device_id
     WHERE d.connection = 'zherodius' AND COALESCE(d.is_enabled, TRUE) ORDER BY d.name`
  );
  return r.rows.map((x) => ({ deviceId: x.device_id, name: x.name, version: x.version }));
}

/** Note that the owner was told about this version; false when they already were. */
export async function markUpdateTold(deviceId: string, version: string): Promise<boolean> {
  const r = await getPool().query(
    `UPDATE zherodius_pairings SET update_told = $2 WHERE device_id = $1 AND update_told IS DISTINCT FROM $2`,
    [deviceId, version]
  );
  return (r.rowCount ?? 0) > 0;
}

/** The device now knows Nexternel by this name. */
export function saveHubName(deviceId: string, name: string): void {
  void getPool().query(`UPDATE zherodius_pairings SET hub_name = $2 WHERE device_id = $1`, [deviceId, name]).catch(() => undefined);
}

/** The device's address now, from what the home network search has heard (Zherodius devices announce their serial). */
export async function findAddress(serial: string): Promise<string | null> {
  const raw = await askLocalName<RawSearch>(`/search?waitMs=2000`, 12_000);
  const hit = raw.services.find((s) => s.type === "_zherodius._tcp" && s.txt?.serial === serial && s.address);
  return hit?.address ?? null;
}

/**
 * A device was just paired: it becomes a Nexternel device (or, paired again, keeps being the same one
 * with its new key and address). Gives its device id.
 */
export async function savePairedDevice(o: { hello: Hello; address: string; roomId: string | null; hubName: string }): Promise<string> {
  const slug = `zherodius-${o.hello.serial.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ device_id: string }>(`SELECT device_id FROM zherodius_pairings WHERE serial = $1`, [o.hello.serial]);
    let deviceId = existing.rows[0]?.device_id;
    if (!deviceId) {
      const d = await client.query<{ id: string }>(
        `INSERT INTO devices (name, slug, room_id, firmware_type, connection, is_enabled, is_online)
         VALUES ($1, $2, $3, '${ZHERODIUS_FIRMWARE}', 'zherodius', TRUE, FALSE)
         RETURNING id`,
        [o.hello.name.trim() || o.hello.serial, slug, o.roomId]
      );
      deviceId = d.rows[0]!.id;
    }
    await client.query(
      `INSERT INTO zherodius_pairings (device_id, serial, address, device_key, version, hub_name, paired_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (device_id) DO UPDATE SET address = EXCLUDED.address, device_key = EXCLUDED.device_key,
         version = EXCLUDED.version, hub_name = EXCLUDED.hub_name, cfg = NULL, paired_at = NOW()`,
      [deviceId, o.hello.serial, o.address, o.hello.key.toLowerCase(), o.hello.version, o.hubName]
    );
    await client.query("COMMIT");
    return deviceId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** For the backup: this home's line key and the pairings (null: no Zherodius device was ever paired). */
export async function exportZherodius(): Promise<ZherodiusBackup | null> {
  const hub = await getPool().query<{ private_key: string }>(`SELECT private_key FROM zherodius_hub WHERE id = 1`);
  if (!hub.rows[0]) return null;
  const p = await getPool().query<{ device_id: string; serial: string; address: string; device_key: string; version: string | null }>(
    `SELECT device_id, serial, address, device_key, version FROM zherodius_pairings ORDER BY serial`
  );
  return {
    hubKey: hub.rows[0].private_key,
    pairings: p.rows.map((r) => ({ deviceId: r.device_id, serial: r.serial, address: r.address, deviceKey: r.device_key, version: r.version })),
  };
}

/** From a backup (after its devices were restored): the line key and the pairings of devices that exist. */
export async function restoreZherodius(b: ZherodiusBackup): Promise<number> {
  if (!/^[0-9a-f]{64}$/i.test(b.hubKey)) throw new Error("The backup's Zherodius line key could not be read");
  const client = await getPool().connect();
  let kept = 0;
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO zherodius_hub (id, private_key) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET private_key = EXCLUDED.private_key`,
      [b.hubKey.toLowerCase()]
    );
    await client.query(`DELETE FROM zherodius_pairings`);
    for (const p of b.pairings ?? []) {
      const r = await client.query(
        `INSERT INTO zherodius_pairings (device_id, serial, address, device_key, version)
         SELECT $1::uuid, $2, $3, $4, $5 WHERE EXISTS (SELECT 1 FROM devices WHERE id = $1::uuid)`,
        [p.deviceId, p.serial, p.address, p.deviceKey, p.version]
      );
      kept += r.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  forgetHubKeyCache();
  return kept;
}
