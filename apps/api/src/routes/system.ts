import os from "os";
import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { checkDatabase } from "../db.js";
import { getMqttStatus } from "../telemetry/mqtt.js";
import { config } from "../config.js";
import { APP_VERSION } from "../version.js";
import { readServerTemperatureC } from "../lib/server-temperature.js";
import { readMemoryStats, readHostUptimeSeconds, sampleCpuLoadPercent } from "../lib/host-metrics.js";
import { restartNexternelServices, type RestartableService } from "../backup/post-restore.js";
import { repairMqttConnection } from "../system/repair-mqtt.js";

const WAN_CACHE_TTL_MS = 5 * 60_000;
let wanCache: { ip: string | null; at: number } | null = null;

async function resolveWanIp(): Promise<string | null> {
  const now = Date.now();
  if (wanCache && now - wanCache.at < WAN_CACHE_TTL_MS) {
    return wanCache.ip;
  }
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      wanCache = { ip: wanCache?.ip ?? null, at: now };
      return wanCache.ip;
    }
    const data = (await res.json()) as { ip?: string };
    const ip = data.ip?.trim() || null;
    wanCache = { ip, at: now };
    return ip;
  } catch {
    wanCache = { ip: wanCache?.ip ?? null, at: now };
    return wanCache.ip;
  }
}

function lanIp(): string | null {
  const fromEnv = config.serverIp()?.trim();
  if (fromEnv) return fromEnv;
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const e of entries) {
      if (e.family === "IPv4" && !e.internal) return e.address;
    }
  }
  return null;
}

export const systemRoutes: FastifyPluginAsync = async (app) => {
  // Warm CPU sampler so the first dashboard poll can use a real delta
  sampleCpuLoadPercent();

  app.get("/api/v1/system", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;

    const cpus = os.cpus();
    const cpuCount = cpus.length || 1;
    const loadPercent = sampleCpuLoadPercent();

    const [database, wanIp, temperatureC, memory, hostUptimeSeconds] = await Promise.all([
      checkDatabase(),
      resolveWanIp(),
      readServerTemperatureC(),
      readMemoryStats(),
      readHostUptimeSeconds(),
    ]);
    const mqtt = getMqttStatus();
    const lan = lanIp();

    return {
      version: APP_VERSION,
      service: "api",
      /** API container process uptime (resets when the api service restarts). */
      uptimeSeconds: Math.floor(process.uptime()),
      /** Host OS uptime when /proc/uptime is available. */
      hostUptimeSeconds,
      cpu: {
        model: cpus[0]?.model?.trim() || "CPU",
        cores: cpuCount,
        loadPercent,
      },
      memory,
      temperatureC,
      lanIp: lan,
      wanIp,
      database,
      mqtt: mqtt.status,
      mqttError: mqtt.lastError ?? null,
      measuredAt: new Date().toISOString(),
    };
  });

  app.post<{
    Body: { service?: RestartableService };
  }>("/api/v1/system/restart-services", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const service = request.body?.service ?? "all";
    const allowed: RestartableService[] = ["all", "mqtt", "api"];
    if (!allowed.includes(service)) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "Unknown service." },
      });
    }
    const result = await restartNexternelServices(service);
    if (!result.ok) {
      return reply.code(400).send({
        error: { code: "restart_failed", message: result.message },
      });
    }
    return { ok: true, message: result.message };
  });

  app.post("/api/v1/system/repair-mqtt", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const result = await repairMqttConnection();
    if (!result.ok) {
      return reply.code(400).send({
        error: { code: "mqtt_repair_failed", message: result.message },
      });
    }
    return { ok: true, message: result.message };
  });
};
