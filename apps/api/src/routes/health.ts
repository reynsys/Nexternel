import type { FastifyPluginAsync } from "fastify";
import { CAPABILITY_KINDS } from "@nexternel/domain";
import { checkDatabase } from "../db.js";
import { getMqttStatus } from "../telemetry/mqtt.js";
import { APP_VERSION } from "../version.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/health", async () => {
    const database = await checkDatabase();
    const mqtt = getMqttStatus();
    const mqttOk = mqtt.status === "connected";
    return {
      status: database === "ok" && mqttOk ? "ok" : "degraded",
      version: APP_VERSION,
      service: "api",
      database,
      mqtt: mqtt.status,
      mqttError: mqtt.lastError,
      capabilityKindsRegistered: CAPABILITY_KINDS.length,
    };
  });
};
