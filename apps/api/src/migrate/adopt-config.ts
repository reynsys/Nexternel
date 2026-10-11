import path from "path";
import JSZip from "jszip";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { config } from "../config.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { syncAllCamerasToGo2rtc } from "../cameras/service.js";
import { composeRtspUrl, parseRtspUrl } from "../cameras/connection.js";
import { refreshTelemetrySubscriptions } from "../telemetry/mqtt.js";
import { repairDashboardCapabilityBindings } from "./repair-dashboard-bindings.js";
import {
  remapBrokerIpInYaml,
  rewriteDeviceMqttYaml,
  rewriteEsphomeSecretsYaml,
} from "./esphome-rewrite.js";
import { applyTopicRootToPayload } from "./topic-remap.js";
import { ensureDir, esphomeDir, isDirectory, listEsphomeFiles, writeFileEnsured } from "./paths.js";
import type {
  ConfigManifest,
  ConfigPayload,
  ExportedDevice,
} from "./types.js";
import { CONFIG_FORMAT, CONFIG_FORMAT_VERSION } from "./types.js";

export type AdoptOptions = {
  newBrokerIp: string;
  /** First MQTT path segment on the new system, e.g. nexternel (replaces damnhome/...). */
  newTopicRoot: string;
  /** Optional: new Wi‑Fi for cutover pack (devices moving to a different network). */
  wifiSsid?: string;
  wifiPassword?: string;
  confirm: string;
};

export type AdoptResult = {
  ok: true;
  manifest: ConfigManifest;
  counts: {
    rooms: number;
    devices: number;
    dashboards: number;
    cameras: number;
    esphomeFiles: number;
  };
  adoptChecklist: {
    brokerIp: string;
    topicRoot: string;
    esphomeUrl: string;
    devices: { name: string; slug: string; yamlHint: string | null; topicPrefix: string }[];
    steps: string[];
  };
};

function parseManifest(raw: string): ConfigManifest {
  const m = JSON.parse(raw) as ConfigManifest;
  if (m.format !== CONFIG_FORMAT) {
    throw new Error(
      "Not a Nexternel configuration backup (.nexcfg)."
    );
  }
  if (m.formatVersion > CONFIG_FORMAT_VERSION) {
    throw new Error(
      `Config format v${m.formatVersion} is newer than this API supports (v${CONFIG_FORMAT_VERSION})`
    );
  }
  return m;
}

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
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [nameRow.id, room.description, room.sortOrder]
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
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [room.id, room.name, room.description, room.sortOrder]
      );
      remap.set(room.id, room.id);
      continue;
    }

    await client.query(
      `INSERT INTO rooms (id, name, description, sort_order)
       VALUES ($1::uuid, $2, $3, $4)`,
      [room.id, room.name, room.description, room.sortOrder]
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
         ip_address, mac_address, firmware_type, is_enabled, is_online
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6,
         NULLIF($7, '')::inet, NULLIF($8, ''), COALESCE($9, 'esphome'),
         COALESCE($10, TRUE), FALSE
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
      ]
    );
  } catch (err) {
    throw new Error(
      `Device "${d.name}" (${d.slug}) failed (${pgErrMessage(err)}).`
    );
  }

  await client.query(`DELETE FROM sensors WHERE device_id = $1::uuid`, [d.id]);
  await client.query(`DELETE FROM relays WHERE device_id = $1::uuid`, [d.id]);

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
      [dash.id, dash.name, JSON.stringify(dash.document ?? {}), dash.isDefault]
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

function yamlHintForDevice(d: ExportedDevice, esphomeRels: string[]): string | null {
  const name = (d.esphomeName || d.slug || "").toLowerCase();
  if (!name) return null;
  const hit = esphomeRels.find((r) => {
    const b = path.basename(r, path.extname(r)).toLowerCase();
    return b === name || r.toLowerCase().includes(name);
  });
  return hit ?? null;
}

async function writeEsphomeFiles(
  zip: JSZip,
  oldIp: string,
  newBrokerIp: string,
  devices: ExportedDevice[],
  wifi?: { ssid?: string; password?: string }
): Promise<number> {
  const root = esphomeDir();
  if (!isDirectory(root)) {
    ensureDir(root);
  }
  const mqttUser = config.mqttUsername();
  const mqttPass = config.mqttPassword();
  const prefix = "esphome/";
  let count = 0;

  const byStem = new Map<string, ExportedDevice>();
  for (const d of devices) {
    const stem = (d.esphomeName || d.slug || "").toLowerCase().trim();
    if (stem) byStem.set(stem, d);
  }

  const names = Object.keys(zip.files).filter(
    (n) => n.startsWith(prefix) && !zip.files[n]!.dir
  );

  for (const name of names) {
    const rel = name.slice(prefix.length);
    if (!rel || rel.includes("..")) continue;
    if (rel.includes(".esphome/") || rel.endsWith(".bin")) continue;
    if (!/\.ya?ml$/i.test(rel)) continue;

    let text = await zip.files[name]!.async("string");
    const base = path.basename(rel).toLowerCase();
    if (base === "secrets.yaml" || base === "secrets.yml") {
      text = rewriteEsphomeSecretsYaml(text, {
        brokerIp: newBrokerIp,
        mqttUsername: mqttUser,
        mqttPassword: mqttPass,
        wifiSsid: wifi?.ssid,
        wifiPassword: wifi?.password,
      });
    } else {
      text = remapBrokerIpInYaml(text, oldIp, newBrokerIp);
      const stem = path.basename(rel, path.extname(rel)).toLowerCase();
      const device = byStem.get(stem);
      if (device) {
        text = rewriteDeviceMqttYaml(text, {
          brokerIp: newBrokerIp,
          mqttUsername: mqttUser,
          mqttPassword: mqttPass,
          topicPrefix: device.mqttTopicPrefix,
        });
      }
    }
    writeFileEnsured(path.join(root, rel), text);
    count += 1;
  }
  return count;
}

/** Zip current /esphome YAML after Adopt — copy onto the OLD server and OTA there. */
export async function createEsphomeCutoverPack(): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const zip = new JSZip();
  let n = 0;
  for (const { rel, data } of listEsphomeFiles()) {
    if (!/\.ya?ml$/i.test(rel)) continue;
    zip.file(rel, data);
    n += 1;
  }
  if (n === 0) {
    throw new Error("No ESPHome YAML on this server yet — run Adopt first");
  }
  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );
  const day = new Date().toISOString().slice(0, 10);
  return { buffer, filename: `esphome-cutover-${day}.zip` };
}

export async function adoptConfigArchive(
  buffer: Buffer,
  options: AdoptOptions
): Promise<AdoptResult> {
  if (options.confirm !== "ADOPT") {
    throw new Error('Confirmation required: set confirm to "ADOPT"');
  }
  const newBrokerIp = options.newBrokerIp.trim();
  if (!newBrokerIp) {
    throw new Error("newBrokerIp is required (MQTT broker / server LAN IP)");
  }
  const newTopicRoot =
    options.newTopicRoot.trim() ||
    process.env.MQTT_TOPIC_PREFIX?.trim() ||
    "nexternel";

  const zip = await JSZip.loadAsync(buffer);
  const manifestEntry = zip.file("manifest.json");
  const configEntry = zip.file("config.json");
  if (!manifestEntry || !configEntry) {
    throw new Error("Invalid .nexcfg: missing manifest.json or config.json");
  }

  const manifest = parseManifest(await manifestEntry.async("string"));
  let payload = JSON.parse(await configEntry.async("string")) as ConfigPayload;
  if (!payload || !Array.isArray(payload.rooms) || !Array.isArray(payload.devices)) {
    throw new Error("Invalid config.json payload");
  }
  payload.dashboards = Array.isArray(payload.dashboards) ? payload.dashboards : [];
  payload.cameras = Array.isArray(payload.cameras) ? payload.cameras : [];

  // Align all MQTT topics to this server's topic root (damnhome/… → nexternel/…)
  payload = applyTopicRootToPayload(payload, newTopicRoot);

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const roomRemap = await upsertRooms(client, payload);
    for (const d of payload.devices) {
      await upsertDevice(client, d, roomRemap);
    }
    await upsertDashboards(client, payload);
    await upsertCameras(client, payload, roomRemap);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const esphomeFiles = await writeEsphomeFiles(
    zip,
    manifest.serverIp || "",
    newBrokerIp,
    payload.devices,
    { ssid: options.wifiSsid, password: options.wifiPassword }
  );

  try {
    await syncCapabilitiesFromLegacy();
    await repairDashboardCapabilityBindings();
    await refreshTelemetrySubscriptions();
  } catch {
    /* next boot will sync */
  }
  try {
    await syncAllCamerasToGo2rtc();
  } catch {
    /* go2rtc may be down */
  }

  const esphomeRels = Object.keys(zip.files)
    .filter((n) => n.startsWith("esphome/") && !zip.files[n]!.dir)
    .map((n) => n.slice("esphome/".length));

  const esphomeUrl = `http://${newBrokerIp}:6052`;
  const adoptChecklist = {
    brokerIp: newBrokerIp,
    topicRoot: newTopicRoot,
    esphomeUrl,
    devices: payload.devices.map((d) => ({
      name: d.name,
      slug: d.slug,
      yamlHint: yamlHintForDevice(d, esphomeRels),
      topicPrefix: d.mqttTopicPrefix,
    })),
    steps: [
      `Configuration is on this server (areas, devices, dashboards, cameras). MQTT topics use "${newTopicRoot}/…" and broker ${newBrokerIp}.`,
      `ESP32 boards still need a firmware install so they use this broker and Wi‑Fi. YAML is ready under ESPHome on this server.`,
      `Flash each device: open ${esphomeUrl} → select the device → Install → Plug into this computer (USB). Or use https://web.esphome.io with the YAML pack below.`,
      `Optional: download the flash-ready YAML pack to install from a laptop.`,
      `If devices must join a different Wi‑Fi, set Wi‑Fi SSID/password before Restore so the YAML includes it, then flash once.`,
    ],
  };

  return {
    ok: true,
    manifest,
    counts: {
      rooms: payload.rooms.length,
      devices: payload.devices.length,
      dashboards: payload.dashboards.length,
      cameras: payload.cameras.length,
      esphomeFiles,
    },
    adoptChecklist,
  };
}
