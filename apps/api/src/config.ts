import { readCarriedMqttLogin } from "./mqtt-login.js";
import { detectedHostIp } from "./system/host-ip.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * Runtime config for the V3 API.
 * JWT_SECRET may reuse V2 NEXTAUTH_SECRET so one secret works in compose.
 */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? "0.0.0.0",
  databaseUrl: () => required("DATABASE_URL"),
  jwtSecret: () => {
    const raw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "";
    const s = raw.trim().replace(/^["']|["']$/g, "");
    if (!s) {
      throw new Error("JWT_SECRET or NEXTAUTH_SECRET is not set");
    }
    return s;
  },
  accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  cookieSecure:
    process.env.COOKIE_SECURE === "true"
      ? true
      : process.env.COOKIE_SECURE === "false"
        ? false
        : false,
  mqttBroker: () => {
    const fallback = "mqtt://mosquitto:1883";
    const raw = (process.env.MQTT_BROKER || fallback).trim();
    // Inside Docker, localhost is the API container — not Mosquitto.
    if (/^(mqtts?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(raw)) {
      return fallback;
    }
    // Compose stack: prefer the mosquitto service over SERVER_IP/LAN URL in .env.
    if (process.env.MOSQUITTO_CONFIG_DIR) {
      try {
        const u = new URL(raw);
        const serverIp = (process.env.SERVER_IP || "").trim();
        if (serverIp && u.hostname === serverIp) {
          return fallback;
        }
      } catch {
        return fallback;
      }
    }
    return raw || fallback;
  },
  // A login carried over from a restored backup wins, so the old server's devices keep connecting.
  mqttUsername: () => readCarriedMqttLogin()?.username || process.env.MQTT_USERNAME || "",
  mqttPassword: () => readCarriedMqttLogin()?.password || process.env.MQTT_PASSWORD || "",
  influx: () => ({
    url: process.env.INFLUXDB_URL || "http://influxdb:8086",
    token: process.env.INFLUXDB_TOKEN || "",
    org: process.env.INFLUXDB_ORG || "damnhome",
    bucket: process.env.INFLUXDB_BUCKET || "sensors",
  }),
  // The address detected on the home network wins over the install-time value in .env.
  serverIp: () => detectedHostIp() || process.env.SERVER_IP || "",
  /** Internal go2rtc base URL (API → go2rtc container). */
  go2rtcUrl: () => process.env.GO2RTC_URL || "http://go2rtc:1984",
  /**
   * Browser-facing go2rtc base for HLS/MSE.
   * Empty / unset → same-origin `/go2rtc` (UI nginx proxy — preferred).
   * Set GO2RTC_PUBLIC_URL only if you intentionally expose go2rtc directly.
   */
  go2rtcPublicUrl: () => {
    const explicit = (process.env.GO2RTC_PUBLIC_URL || "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    return "";
  },
};

export const ACCESS_COOKIE = "nexternel_access";
export const REFRESH_COOKIE = "nexternel_refresh";
