import { getPool } from "../db.js";
import { parseRtspUrl } from "../cameras/connection.js";
import { askLocalName, LocalNameUnavailable } from "./local-name.js";
import { classifySearch, type FoundDevice, type RawSearch } from "./classify.js";

export class HomeNetworkSearchUnavailable extends Error {}

async function askSearch(waitMs: number): Promise<RawSearch> {
  try {
    return await askLocalName<RawSearch>(`/search?waitMs=${Math.round(waitMs)}`, waitMs + 10_000);
  } catch (err) {
    if (err instanceof LocalNameUnavailable) throw new HomeNetworkSearchUnavailable("The home network search is not running.");
    throw err;
  }
}

/** Look around the home network and name what is there (and what Nexternel already has). */
export async function searchHomeNetwork(waitMs = 4000): Promise<FoundDevice[]> {
  const raw = await askSearch(waitMs);
  const pool = getPool();
  const [devices, cameras] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      firmware_type: string | null;
      esphome_name: string | null;
      mqtt_topic_prefix: string | null;
      ip_address: string | null;
      mac_address: string | null;
      zherodius_serial: string | null;
    }>(
      `SELECT d.id, d.name, d.firmware_type, d.esphome_name, d.mqtt_topic_prefix, host(d.ip_address) AS ip_address, d.mac_address,
              z.serial AS zherodius_serial
       FROM devices d LEFT JOIN zherodius_pairings z ON z.device_id = d.id`
    ),
    pool.query<{ id: string; name: string; rtsp_url: string }>(`SELECT id, name, rtsp_url FROM cameras`),
  ]);
  return classifySearch(raw, {
    devices: devices.rows.map((d) => ({
      id: d.id,
      name: d.name,
      firmwareType: d.firmware_type,
      esphomeName: d.esphome_name,
      mqttTopicPrefix: d.mqtt_topic_prefix,
      ipAddress: d.ip_address,
      macAddress: d.mac_address,
      zherodiusSerial: d.zherodius_serial,
    })),
    cameras: cameras.rows.map((c) => ({ id: c.id, name: c.name, host: parseRtspUrl(c.rtsp_url)?.host ?? null })),
  });
}
