import JSZip from "jszip";
import { getPool } from "../db.js";
import { config } from "../config.js";
import { APP_VERSION } from "../version.js";
import { listEsphomeFiles, isDirectory, esphomeDir } from "./paths.js";
import type {
  ConfigManifest,
  ConfigPayload,
  ExportedCamera,
  ExportedDashboard,
  ExportedDevice,
  ExportedRelay,
  ExportedRoom,
  ExportedSensor,
} from "./types.js";
import { CONFIG_FORMAT, CONFIG_FORMAT_VERSION } from "./types.js";

async function loadRooms(): Promise<ExportedRoom[]> {
  const r = await getPool().query<{
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
  }>(`SELECT id, name, description, sort_order FROM rooms ORDER BY sort_order, name`);
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  }));
}

async function loadDevices(): Promise<ExportedDevice[]> {
  const devices = await getPool().query<{
    id: string;
    room_id: string | null;
    name: string;
    slug: string;
    esphome_name: string | null;
    mqtt_topic_prefix: string;
    ip_address: string | null;
    mac_address: string | null;
    firmware_type: string;
    is_enabled: boolean;
  }>(
    `SELECT id, room_id, name, slug, esphome_name, mqtt_topic_prefix,
            host(ip_address)::text AS ip_address, mac_address,
            COALESCE(firmware_type, 'esphome') AS firmware_type,
            COALESCE(is_enabled, TRUE) AS is_enabled
     FROM devices
     ORDER BY name`
  );
  if (devices.rows.length === 0) return [];

  const ids = devices.rows.map((d) => d.id);
  const sensors = await getPool().query<{
    id: string;
    device_id: string;
    name: string;
    slug: string;
    sensor_type: string;
    unit: string | null;
    mqtt_state_topic: string;
    esphome_entity_id: string | null;
    gpio_pin: number | null;
    is_enabled: boolean;
  }>(
    `SELECT id, device_id, name, slug, sensor_type, unit, mqtt_state_topic,
            esphome_entity_id, gpio_pin, COALESCE(is_enabled, TRUE) AS is_enabled
     FROM sensors WHERE device_id = ANY($1::uuid[])`,
    [ids]
  );
  const relays = await getPool().query<{
    id: string;
    device_id: string;
    name: string;
    slug: string;
    mqtt_command_topic: string;
    mqtt_state_topic: string;
    esphome_entity_id: string | null;
    gpio_pin: number | null;
    is_enabled: boolean;
    last_state: string | null;
  }>(
    `SELECT id, device_id, name, slug, mqtt_command_topic, mqtt_state_topic,
            esphome_entity_id, gpio_pin, COALESCE(is_enabled, TRUE) AS is_enabled,
            last_state
     FROM relays WHERE device_id = ANY($1::uuid[])`,
    [ids]
  );

  const sensorsByDev = new Map<string, ExportedSensor[]>();
  for (const s of sensors.rows) {
    const list = sensorsByDev.get(s.device_id) ?? [];
    list.push({
      id: s.id,
      name: s.name,
      slug: s.slug,
      sensorType: s.sensor_type,
      unit: s.unit,
      mqttStateTopic: s.mqtt_state_topic,
      esphomeEntityId: s.esphome_entity_id,
      gpioPin: s.gpio_pin,
      isEnabled: s.is_enabled,
    });
    sensorsByDev.set(s.device_id, list);
  }
  const relaysByDev = new Map<string, ExportedRelay[]>();
  for (const rel of relays.rows) {
    const list = relaysByDev.get(rel.device_id) ?? [];
    list.push({
      id: rel.id,
      name: rel.name,
      slug: rel.slug,
      mqttCommandTopic: rel.mqtt_command_topic,
      mqttStateTopic: rel.mqtt_state_topic,
      esphomeEntityId: rel.esphome_entity_id,
      gpioPin: rel.gpio_pin,
      isEnabled: rel.is_enabled,
      lastState: rel.last_state,
    });
    relaysByDev.set(rel.device_id, list);
  }

  return devices.rows.map((d) => ({
    id: d.id,
    roomId: d.room_id,
    name: d.name,
    slug: d.slug,
    esphomeName: d.esphome_name,
    mqttTopicPrefix: d.mqtt_topic_prefix,
    ipAddress: d.ip_address,
    macAddress: d.mac_address,
    firmwareType: d.firmware_type,
    isEnabled: d.is_enabled,
    sensors: sensorsByDev.get(d.id) ?? [],
    relays: relaysByDev.get(d.id) ?? [],
  }));
}

async function loadDashboards(): Promise<ExportedDashboard[]> {
  const r = await getPool().query<{
    id: string;
    name: string;
    document: unknown;
    is_default: boolean;
  }>(`SELECT id, name, document, is_default FROM v3_dashboards ORDER BY name`);
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    document: row.document,
    isDefault: row.is_default,
  }));
}

async function loadCameras(): Promise<ExportedCamera[]> {
  const r = await getPool().query<{
    id: string;
    name: string;
    stream_id: string;
    rtsp_url: string;
    rtsp_host: string | null;
    rtsp_port: number | null;
    rtsp_path: string | null;
    rtsp_username: string | null;
    rtsp_password: string | null;
    area_id: string | null;
    enabled: boolean;
    sort_order: number;
  }>(
    `SELECT id, name, stream_id, rtsp_url,
            rtsp_host, rtsp_port, rtsp_path, rtsp_username, rtsp_password,
            area_id, enabled, sort_order
     FROM cameras ORDER BY sort_order, name`
  );
  return r.rows.map((row) => ({
    id: row.id,
    name: row.name,
    streamId: row.stream_id,
    rtspUrl: row.rtsp_url,
    host: row.rtsp_host ?? undefined,
    port: row.rtsp_port ?? undefined,
    path: row.rtsp_path ?? undefined,
    username: row.rtsp_username ?? undefined,
    password: row.rtsp_password ?? undefined,
    areaId: row.area_id,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  }));
}

export async function buildConfigPayload(): Promise<ConfigPayload> {
  const [rooms, devices, dashboards, cameras] = await Promise.all([
    loadRooms(),
    loadDevices(),
    loadDashboards(),
    loadCameras(),
  ]);
  return { rooms, devices, dashboards, cameras };
}

export async function createConfigExport(): Promise<{
  buffer: Buffer;
  filename: string;
  manifest: ConfigManifest;
  counts: {
    rooms: number;
    devices: number;
    dashboards: number;
    cameras: number;
    esphomeFiles: number;
  };
}> {
  const payload = await buildConfigPayload();
  const zip = new JSZip();

  const manifest: ConfigManifest = {
    format: CONFIG_FORMAT,
    formatVersion: CONFIG_FORMAT_VERSION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    serverIp: config.serverIp() || "",
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("config.json", JSON.stringify(payload, null, 2));

  let esphomeFiles = 0;
  if (isDirectory(esphomeDir())) {
    for (const { rel, data } of listEsphomeFiles()) {
      zip.file(`esphome/${rel}`, data);
      esphomeFiles += 1;
    }
  }

  const buffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );

  const day = manifest.createdAt.slice(0, 10);
  const filename = `nexternel-config-${day}.nexcfg`;

  return {
    buffer,
    filename,
    manifest,
    counts: {
      rooms: payload.rooms.length,
      devices: payload.devices.length,
      dashboards: payload.dashboards.length,
      cameras: payload.cameras.length,
      esphomeFiles,
    },
  };
}
