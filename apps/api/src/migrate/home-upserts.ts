/**
 * Writing a backup's areas, devices, dashboards and cameras into the database (used by backup restore,
 * backup/domain-restore.ts).
 */
import { connectionFromFirmwareSql } from "../devices/ensure-schema.js";
import type { PoolClient } from "pg";
import { composeRtspUrl, parseRtspUrl } from "../cameras/connection.js";
import type { ConfigPayload, ExportedDevice } from "./types.js";

function pgErrMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return err instanceof Error ? err.message : String(err);
}

function mapId(
  id: string | null | undefined,
  remap: Map<string, string>
): string | null {
  if (!id) return null;
  return remap.get(id) ?? id;
}

/**
 * Upsert areas. If the new server already has "Living Room" under a different
 * UUID, keep that row and remap export room ids → local ids (devices/cameras).
 */
export async function upsertRooms(
  client: PoolClient,
  payload: ConfigPayload
): Promise<Map<string, string>> {
  const remap = new Map<string, string>();

  for (const room of payload.rooms) {
    const byId = await client.query<{ id: string }>(
      `SELECT id FROM rooms WHERE id = $1::uuid`,
      [room.id]
    );
    const byName = await client.query<{ id: string }>(
      `SELECT id FROM rooms WHERE lower(name) = lower($1)`,
      [room.name]
    );

    const idRow = byId.rows[0];
    const nameRow = byName.rows[0];

    if (nameRow && (!idRow || nameRow.id !== room.id)) {
      // Same name already exists under another (or only) id — adopt into that row
      await client.query(
        `UPDATE rooms SET
           description = $2,
           sort_order = $3,
           icon = COALESCE($4, icon),
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [nameRow.id, room.description, room.sortOrder, room.icon ?? null]
      );
      remap.set(room.id, nameRow.id);
      continue;
    }

    if (idRow) {
      await client.query(
        `UPDATE rooms SET
           name = $2,
           description = $3,
           sort_order = $4,
           icon = COALESCE($5, icon),
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [room.id, room.name, room.description, room.sortOrder, room.icon ?? null]
      );
      remap.set(room.id, room.id);
      continue;
    }

    await client.query(
      `INSERT INTO rooms (id, name, description, sort_order, icon)
       VALUES ($1::uuid, $2, $3, $4, $5)`,
      [room.id, room.name, room.description, room.sortOrder, room.icon ?? null]
    );
    remap.set(room.id, room.id);
  }

  return remap;
}

export async function upsertDevice(
  client: PoolClient,
  d: ExportedDevice,
  roomRemap: Map<string, string>
) {
  const roomId = mapId(d.roomId, roomRemap);

  // Same slug under a different id (manual device on new server) → remove local, keep export ids
  const bySlug = await client.query<{ id: string }>(
    `SELECT id FROM devices WHERE slug = $1`,
    [d.slug]
  );
  if (bySlug.rows[0] && bySlug.rows[0].id !== d.id) {
    await client.query(`DELETE FROM devices WHERE id = $1::uuid`, [
      bySlug.rows[0].id,
    ]);
  }

  try {
    await client.query(
      `INSERT INTO devices (
         id, room_id, name, slug, esphome_name, mqtt_topic_prefix,
         ip_address, mac_address, firmware_type, is_enabled, is_online, connection
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6,
         NULLIF($7, '')::inet, NULLIF($8, ''), COALESCE($9, 'esphome'),
         COALESCE($10, TRUE), FALSE, COALESCE($11, ${connectionFromFirmwareSql("$9::text")})
       )
       ON CONFLICT (id) DO UPDATE SET
         room_id = EXCLUDED.room_id,
         name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         esphome_name = EXCLUDED.esphome_name,
         mqtt_topic_prefix = EXCLUDED.mqtt_topic_prefix,
         ip_address = EXCLUDED.ip_address,
         mac_address = EXCLUDED.mac_address,
         firmware_type = EXCLUDED.firmware_type,
         connection = EXCLUDED.connection,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()`,
      [
        d.id,
        roomId,
        d.name,
        d.slug,
        d.esphomeName,
        d.mqttTopicPrefix,
        d.ipAddress ?? "",
        d.macAddress ?? "",
        d.firmwareType,
        d.isEnabled,
        d.connection ?? null,
      ]
    );
  } catch (err) {
    throw new Error(
      `Device "${d.name}" (${d.slug}) failed (${pgErrMessage(err)}).`
    );
  }

  await client.query(`DELETE FROM sensors WHERE device_id = $1::uuid`, [d.id]);
  await client.query(`DELETE FROM relays WHERE device_id = $1::uuid`, [d.id]);
  await client.query(`DELETE FROM device_controls WHERE device_id = $1::uuid`, [d.id]);

  for (const s of d.sensors) {
    await client.query(
      `INSERT INTO sensors (
         id, device_id, name, slug, sensor_type, unit, mqtt_state_topic,
         esphome_entity_id, gpio_pin, is_enabled
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, TRUE)
       )`,
      [
        s.id,
        d.id,
        s.name,
        s.slug,
        s.sensorType,
        s.unit,
        s.mqttStateTopic,
        s.esphomeEntityId,
        s.gpioPin,
        s.isEnabled,
      ]
    );
  }

  for (const dc of d.controls ?? []) {
    await client.query(
      `INSERT INTO device_controls (id, device_id, name, slug, control_type, features, command_topic, state_topic, is_enabled)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9)`,
      [dc.id, d.id, dc.name, dc.slug, dc.controlType, JSON.stringify(dc.features ?? {}), dc.commandTopic, dc.stateTopic, dc.isEnabled]
    );
  }

  for (const r of d.relays) {
    await client.query(
      `INSERT INTO relays (
         id, device_id, name, slug, mqtt_command_topic, mqtt_state_topic,
         esphome_entity_id, gpio_pin, is_enabled, last_state
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE), $10
       )`,
      [
        r.id,
        d.id,
        r.name,
        r.slug,
        r.mqttCommandTopic,
        r.mqttStateTopic,
        r.esphomeEntityId,
        r.gpioPin,
        r.isEnabled,
        r.lastState,
      ]
    );
  }
}

export async function upsertDashboards(client: PoolClient, payload: ConfigPayload) {
  // The restored start dashboard replaces this Nexternel's own (only one may be marked).
  const restoredStart = payload.dashboards.find((d) => d.isDefault);
  if (restoredStart) {
    await client.query(`UPDATE v3_dashboards SET is_default = FALSE WHERE is_default = TRUE AND id <> $1::uuid`, [restoredStart.id]);
  }
  for (const dash of payload.dashboards) {
    // Shared dashboards — do not bind to a user from the old server
    await client.query(
      `INSERT INTO v3_dashboards (id, owner_user_id, name, document, is_default)
       VALUES ($1::uuid, NULL, $2, $3::jsonb, $4)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         document = EXCLUDED.document,
         is_default = EXCLUDED.is_default,
         owner_user_id = NULL,
         updated_at = NOW()`,
      [dash.id, dash.name, JSON.stringify(dash.document ?? {}), dash.id === restoredStart?.id]
    );
  }
}

export async function upsertCameras(
  client: PoolClient,
  payload: ConfigPayload,
  roomRemap: Map<string, string>
) {
  for (const cam of payload.cameras) {
    const areaId = mapId(cam.areaId, roomRemap);

    const byStream = await client.query<{ id: string }>(
      `SELECT id FROM cameras WHERE stream_id = $1`,
      [cam.streamId]
    );
    if (byStream.rows[0] && byStream.rows[0].id !== cam.id) {
      await client.query(`DELETE FROM cameras WHERE id = $1::uuid`, [
        byStream.rows[0].id,
      ]);
    }

    let host = cam.host?.trim() || "";
    let port = cam.port && cam.port > 0 ? Math.trunc(cam.port) : 554;
    let rtspPath = (cam.path || "/").trim() || "/";
    let username = cam.username ?? "";
    let password = cam.password ?? "";

    if (!host && cam.rtspUrl) {
      const parsed = parseRtspUrl(cam.rtspUrl);
      if (parsed) {
        host = parsed.host;
        port = parsed.port;
        rtspPath = parsed.path;
        username = parsed.username;
        password = parsed.password;
      }
    }

    if (!host) {
      throw new Error(
        `Camera "${cam.name}" has no host (and RTSP URL could not be parsed).`
      );
    }

    const rtspUrl = composeRtspUrl({
      host,
      port,
      path: rtspPath,
      username,
      password,
    });

    try {
      await client.query(
        `INSERT INTO cameras (
           id, name, stream_id, rtsp_url,
           rtsp_host, rtsp_port, rtsp_path, rtsp_username, rtsp_password,
           area_id, enabled, sort_order
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9,
           $10::uuid, COALESCE($11, TRUE), COALESCE($12, 0)
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           stream_id = EXCLUDED.stream_id,
           rtsp_url = EXCLUDED.rtsp_url,
           rtsp_host = EXCLUDED.rtsp_host,
           rtsp_port = EXCLUDED.rtsp_port,
           rtsp_path = EXCLUDED.rtsp_path,
           rtsp_username = EXCLUDED.rtsp_username,
           rtsp_password = EXCLUDED.rtsp_password,
           area_id = EXCLUDED.area_id,
           enabled = EXCLUDED.enabled,
           sort_order = EXCLUDED.sort_order,
           updated_at = NOW()`,
        [
          cam.id,
          cam.name,
          cam.streamId,
          rtspUrl,
          host,
          port,
          rtspPath,
          username,
          password,
          areaId,
          cam.enabled,
          cam.sortOrder,
        ]
      );
    } catch (err) {
      throw new Error(
        `Camera "${cam.name}" failed (${pgErrMessage(err)}). Another camera may already use stream id "${cam.streamId}".`
      );
    }
  }
}


