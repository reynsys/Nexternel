import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { devicePath } from "../devices/device-path-store.js";
import {
  clearOctopusTokenCache,
  discoverElectricityDeviceId,
  discoverGasDeviceId,
} from "./client.js";

export const OCTOPUS_DEVICE_SLUG = "octopus-home-mini";

export type OctopusSettingsRow = {
  account_number: string;
  api_key: string;
  electricity_device_id: string;
  gas_device_id: string;
  gas_consumption_units: string;
  enabled: boolean;
  poll_interval_sec: number;
  last_poll_at: string | null;
  last_error: string | null;
};

export type OctopusSettingsPublic = {
  accountNumber: string;
  hasApiKey: boolean;
  electricityDeviceId: string;
  gasDeviceId: string;
  enabled: boolean;
  pollIntervalSec: number;
  lastPollAt: string | null;
  lastError: string | null;
  deviceRegistered: boolean;
};

export async function getOctopusSettings(): Promise<OctopusSettingsRow | null> {
  const result = await getPool().query<OctopusSettingsRow>(
    `SELECT account_number, api_key, electricity_device_id, gas_device_id, gas_consumption_units,
            enabled, poll_interval_sec, last_poll_at, last_error
     FROM octopus_settings WHERE id = 1`
  );
  return result.rows[0] ?? null;
}

export async function maskOctopusSettings(
  row: OctopusSettingsRow | null
): Promise<OctopusSettingsPublic> {
  const deviceRegistered = await awaitDeviceRegistered();
  if (!row) {
    return {
      accountNumber: "",
      hasApiKey: false,
      electricityDeviceId: "",
      gasDeviceId: "",
      enabled: false,
      pollIntervalSec: 60,
      lastPollAt: null,
      lastError: null,
      deviceRegistered: false,
    };
  }
  return {
    accountNumber: row.account_number,
    hasApiKey: Boolean(row.api_key.trim()),
    electricityDeviceId: row.electricity_device_id,
    gasDeviceId: row.gas_device_id,
    enabled: row.enabled,
    pollIntervalSec: row.poll_interval_sec,
    lastPollAt: row.last_poll_at,
    lastError: row.last_error,
    deviceRegistered,
  };
}

async function awaitDeviceRegistered(): Promise<boolean> {
  const result = await getPool().query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM devices WHERE slug = $1`,
    [OCTOPUS_DEVICE_SLUG]
  );
  return (result.rows[0]?.n ?? 0) > 0;
}

export async function updateOctopusSettings(input: {
  accountNumber?: string;
  apiKey?: string | null;
  electricityDeviceId?: string;
  gasDeviceId?: string;
  enabled?: boolean;
  pollIntervalSec?: number;
}): Promise<OctopusSettingsPublic> {
  const cur = await getOctopusSettings();
  const accountNumber =
    input.accountNumber !== undefined
      ? input.accountNumber.trim()
      : (cur?.account_number ?? "");
  const apiKey =
    input.apiKey !== undefined && input.apiKey !== null
      ? input.apiKey.trim()
      : (cur?.api_key ?? "");
  const electricityDeviceId =
    input.electricityDeviceId !== undefined
      ? input.electricityDeviceId.trim()
      : (cur?.electricity_device_id ?? "");
  const gasDeviceId =
    input.gasDeviceId !== undefined
      ? input.gasDeviceId.trim()
      : (cur?.gas_device_id ?? "");
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : (cur?.enabled ?? false);
  const pollIntervalSec = Math.min(
    300,
    Math.max(30, Math.floor(input.pollIntervalSec ?? cur?.poll_interval_sec ?? 60))
  );

  if (input.apiKey !== undefined && input.apiKey !== null) {
    clearOctopusTokenCache();
  }

  await getPool().query(
    `INSERT INTO octopus_settings (
       id, account_number, api_key, electricity_device_id, gas_device_id,
       enabled, poll_interval_sec, updated_at
     ) VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       account_number = EXCLUDED.account_number,
       api_key = EXCLUDED.api_key,
       electricity_device_id = EXCLUDED.electricity_device_id,
       gas_device_id = EXCLUDED.gas_device_id,
       enabled = EXCLUDED.enabled,
       poll_interval_sec = EXCLUDED.poll_interval_sec,
       updated_at = NOW()`,
    [accountNumber, apiKey, electricityDeviceId, gasDeviceId, enabled, pollIntervalSec]
  );

  if (enabled && accountNumber && apiKey) {
    await ensureOctopusDeviceAndSensors();
    await syncCapabilitiesFromLegacy();
  }

  const row = await getOctopusSettings();
  return await maskOctopusSettings(row);
}

export async function discoverOctopusDeviceIds(): Promise<{
  electricityDeviceId: string | null;
  gasDeviceId: string | null;
  gasConsumptionUnits: string | null;
}> {
  const row = await getOctopusSettings();
  if (!row?.api_key.trim() || !row.account_number.trim()) {
    throw new Error("Account number and API key are required");
  }
  const electricityDeviceId = await discoverElectricityDeviceId(
    row.api_key,
    row.account_number
  );
  const gasDiscovery = await discoverGasDeviceId(row.api_key, row.account_number);
  await getPool().query(
    `UPDATE octopus_settings SET
       electricity_device_id = COALESCE($1, electricity_device_id),
       gas_device_id = COALESCE($2, gas_device_id),
       gas_consumption_units = COALESCE($3, gas_consumption_units),
       updated_at = NOW()
     WHERE id = 1`,
    [electricityDeviceId, gasDiscovery.deviceId, gasDiscovery.consumptionUnits]
  );
  return {
    electricityDeviceId,
    gasDeviceId: gasDiscovery.deviceId,
    gasConsumptionUnits: gasDiscovery.consumptionUnits,
  };
}

export async function ensureOctopusDeviceAndSensors(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM devices WHERE slug = $1`,
      [OCTOPUS_DEVICE_SLUG]
    );

    let deviceId = existing.rows[0]?.id;
    if (!deviceId) {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO devices (
           name, slug, firmware_type, is_enabled, is_online, connection
         ) VALUES (
           'Octopus Home Mini', $1, 'octopus', TRUE, FALSE, 'octopus'
         )
         RETURNING id`,
        [OCTOPUS_DEVICE_SLUG]
      );
      deviceId = inserted.rows[0]!.id;
    } else {
      await client.query(
        `UPDATE devices SET
           name = 'Octopus Home Mini',
           mqtt_topic_prefix = NULL,
           firmware_type = 'octopus',
           connection = 'octopus',
           is_enabled = TRUE,
           updated_at = NOW()
         WHERE id = $1`,
        [deviceId]
      );
    }

    await upsertOctopusSensor(client, deviceId, {
      name: "Live power",
      slug: "live_power",
      sensorType: "power",
      unit: "W",
      entityId: "live_power",
    });
    await upsertOctopusSensor(client, deviceId, {
      name: "Usage today",
      slug: "energy_today",
      sensorType: "energy",
      unit: "kWh",
      entityId: "energy_today",
    });
    await upsertOctopusSensor(client, deviceId, {
      name: "Gas usage today",
      slug: "gas_today",
      sensorType: "energy",
      unit: "kWh",
      entityId: "gas_today",
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function upsertOctopusSensor(
  client: PoolClient,
  deviceId: string,
  sensor: {
    name: string;
    slug: string;
    sensorType: string;
    unit: string;
    entityId: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO sensors (
       device_id, name, slug, sensor_type, unit, esphome_entity_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (device_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       sensor_type = EXCLUDED.sensor_type,
       unit = EXCLUDED.unit,
       mqtt_state_topic = NULL,
       esphome_entity_id = EXCLUDED.esphome_entity_id,
       updated_at = NOW()`,
    [
      deviceId,
      sensor.name,
      sensor.slug,
      sensor.sensorType,
      sensor.unit,
      sensor.entityId,
    ]
  );
}

export async function listOctopusCapabilityIds(): Promise<{
  powerCapabilityId: string | null;
  energyTodayCapabilityId: string | null;
  gasTodayCapabilityId: string | null;
}> {
  const result = await getPool().query<{ id: string; slug: string }>(
    `SELECT c.id, s.slug
     FROM capabilities c
     JOIN sensors s ON s.id = c.source_id AND c.source_type = 'sensor'
     JOIN devices d ON d.id = c.device_id
     WHERE d.slug = $1 AND s.slug IN ('live_power', 'energy_today', 'gas_today')`,
    [OCTOPUS_DEVICE_SLUG]
  );
  let powerCapabilityId: string | null = null;
  let energyTodayCapabilityId: string | null = null;
  let gasTodayCapabilityId: string | null = null;
  for (const row of result.rows) {
    if (row.slug === "live_power") powerCapabilityId = row.id;
    if (row.slug === "energy_today") energyTodayCapabilityId = row.id;
    if (row.slug === "gas_today") gasTodayCapabilityId = row.id;
  }
  return { powerCapabilityId, energyTodayCapabilityId, gasTodayCapabilityId };
}

export async function recordOctopusPollResult(opts: {
  ok: boolean;
  error?: string | null;
}): Promise<void> {
  if (opts.ok) {
    await getPool().query(
      `UPDATE octopus_settings SET
         last_poll_at = NOW(),
         last_error = NULL,
         updated_at = NOW()
       WHERE id = 1`
    );
  } else {
    await getPool().query(
      `UPDATE octopus_settings SET
         last_error = $1,
         updated_at = NOW()
       WHERE id = 1`,
      [opts.error?.slice(0, 500) ?? "Poll failed"]
    );
  }
  // The meter answered (online) or not (offline, its readings no longer current).
  const device = await getPool().query<{ id: string }>(`SELECT id FROM devices WHERE slug = $1`, [OCTOPUS_DEVICE_SLUG]);
  const ids = device.rows.map((r) => r.id);
  if (opts.ok) devicePath.deviceOnline(ids);
  else devicePath.deviceOffline(ids);
}
