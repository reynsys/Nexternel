import type { FastifyPluginAsync } from "fastify";
import { CAPABILITY_KINDS } from "@nexternel/domain";
import { requirePermission } from "../auth/rbac.js";
import { checkDatabase, getPool } from "../db.js";
import { listDevicesDetailed } from "../devices/service.js";
import {
  buildCommandPathDiagnostic,
  buildLivePipelineDiagnostics,
} from "../diagnostics/live-pipeline.js";
import {
  getMqttClientDiagnostics,
  getMqttStatus,
  startBrokerTopicSniff,
} from "../telemetry/mqtt.js";
import { getMqttObservationRing } from "../telemetry/mqtt-observer.js";
import { APP_VERSION } from "../version.js";

async function safeCount(sql: string): Promise<number | null> {
  try {
    const result = await getPool().query<{ c: string }>(sql);
    return Number(result.rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

export const diagnosticsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/diagnostics", async () => {
    const database = await checkDatabase();
    const mqtt = getMqttStatus();
    const mqttOk = mqtt.status === "connected";

    const [capabilities, capabilityBindings, v3Dashboards, devices] = await Promise.all([
      safeCount("SELECT COUNT(*)::text AS c FROM capabilities"),
      safeCount("SELECT COUNT(*)::text AS c FROM capability_bindings"),
      safeCount("SELECT COUNT(*)::text AS c FROM v3_dashboards"),
      listDevicesDetailed().catch(() => []),
    ]);

    const enabledDevices = devices.filter((d) => d.isEnabled);
    const devicesOnline = enabledDevices.filter((d) => d.connectivityState === "online").length;
    const devicesOffline = enabledDevices.filter(
      (d) => d.connectivityState === "offline"
    ).length;
    const devicesNoRecentData = enabledDevices.filter(
      (d) => d.connectivityState === "no_recent_data"
    ).length;

    return {
      status: database === "ok" && mqttOk ? "ok" : "degraded",
      version: APP_VERSION,
      service: "api",
      database,
      mqtt: mqtt.status,
      mqttError: mqtt.lastError ?? null,
      capabilityKindsRegistered: CAPABILITY_KINDS.length,
      counts: {
        capabilities,
        capabilityBindings,
        v3Dashboards,
        devicesEnabled: enabledDevices.length,
        devicesOnline,
        devicesOffline,
        devicesNoRecentData,
      },
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
      },
    };
  });

  app.get("/api/v1/diagnostics/mqtt", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const mqtt = getMqttClientDiagnostics();
    return {
      measuredAt: new Date().toISOString(),
      ...mqtt,
      recentMessages: getMqttObservationRing(50),
    };
  });

  app.post<{
    Body: { durationMs?: number };
  }>("/api/v1/diagnostics/mqtt/sniff", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const durationMs = request.body?.durationMs ?? 30_000;
    const result = await startBrokerTopicSniff(durationMs);
    if (!result.ok) {
      return reply.code(400).send({
        error: { code: "sniff_failed", message: result.message },
      });
    }
    return result;
  });

  app.get<{
    Querystring: { protocol?: string; deviceId?: string };
  }>("/api/v1/diagnostics/pipeline", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const protocol = request.query.protocol?.trim();
    const deviceId = request.query.deviceId?.trim();
    const protocols = protocol
      ? ([protocol] as Array<"shelly-gen1" | "shelly-gen3" | "esphome" | "other">)
      : undefined;
    const report = await buildLivePipelineDiagnostics({
      deviceIds: deviceId ? [deviceId] : undefined,
      protocols,
    });
    return report;
  });

  app.get<{
    Params: { id: string };
  }>("/api/v1/diagnostics/devices/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const report = await buildLivePipelineDiagnostics({
      deviceIds: [request.params.id],
    });
    const device = report.devices[0];
    if (!device) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Device not found" },
      });
    }
    return device;
  });

  app.get<{
    Params: { capabilityId: string };
  }>("/api/v1/diagnostics/capabilities/:capabilityId/command-path", async (
    request,
    reply
  ) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const report = await buildCommandPathDiagnostic(request.params.capabilityId);
    if (!report.ok) {
      return reply.code(404).send({
        error: { code: "not_found", message: report.error },
      });
    }
    return report;
  });
};
