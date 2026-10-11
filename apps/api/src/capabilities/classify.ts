import {
  classifySystemForCapability,
  isSystemId,
  type SystemId,
} from "@nexternel/domain";
import { getPool } from "../db.js";

export type CapabilityOwnershipContext = {
  deviceName?: string | null;
  areaName?: string | null;
  capabilityName?: string | null;
  explicitSystemId?: SystemId | null;
};

export async function applyCapabilityOwnership(
  capabilityId: string,
  deviceId: string,
  kind: string,
  context?: CapabilityOwnershipContext
): Promise<SystemId | null> {
  const pool = getPool();
  const device = await pool.query<{
    room_id: string | null;
    name: string;
    room_name: string | null;
  }>(
    `SELECT d.room_id, d.name, r.name AS room_name
     FROM devices d
     LEFT JOIN rooms r ON r.id = d.room_id
     WHERE d.id = $1`,
    [deviceId]
  );
  const row = device.rows[0];
  const classified =
    context?.explicitSystemId ??
    classifySystemForCapability(kind, {
      deviceName: context?.deviceName ?? row?.name,
      areaName: context?.areaName ?? row?.room_name,
      capabilityName: context?.capabilityName,
    });
  const systemId =
    classified && isSystemId(classified) && classified !== "garden"
      ? classified
      : null;

  await pool.query(
    `UPDATE capabilities
     SET system_id = $1,
         area_id = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [systemId, row?.room_id ?? null, capabilityId]
  );

  return systemId;
}

export async function classifyCapabilitiesForDevice(
  deviceId: string,
  systemOverrides?: Record<string, SystemId>
): Promise<number> {
  const pool = getPool();
  const caps = await pool.query<{
    id: string;
    kind: string;
    name: string;
    source_type: string;
    source_id: string;
  }>(
    `SELECT c.id, c.kind, c.name, c.source_type, c.source_id
     FROM capabilities c
     WHERE c.device_id = $1`,
    [deviceId]
  );

  let count = 0;
  for (const cap of caps.rows) {
    const overrideKey = `${cap.source_type}:${cap.source_id}`;
    const kindOverride = systemOverrides?.[cap.kind];
    await applyCapabilityOwnership(cap.id, deviceId, cap.kind, {
      capabilityName: cap.name,
      explicitSystemId: systemOverrides?.[overrideKey] ?? kindOverride ?? null,
    });
    count += 1;
  }
  return count;
}

export async function classifyAllCapabilities(): Promise<number> {
  const pool = getPool();
  const caps = await pool.query<{
    id: string;
    device_id: string;
    kind: string;
    name: string;
  }>(`SELECT id, device_id, kind, name FROM capabilities`);

  let count = 0;
  for (const cap of caps.rows) {
    await applyCapabilityOwnership(cap.id, cap.device_id, cap.kind, {
      capabilityName: cap.name,
    });
    count += 1;
  }
  return count;
}

export async function syncCapabilityAreasFromDevices(): Promise<number> {
  const result = await getPool().query(
    `UPDATE capabilities c
     SET area_id = d.room_id, updated_at = NOW()
     FROM devices d
     WHERE c.device_id = d.id
       AND (c.area_id IS DISTINCT FROM d.room_id)`
  );
  return result.rowCount ?? 0;
}
