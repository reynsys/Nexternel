import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { SHELLY_MODEL_PRESETS } from "../shelly/models.js";
import {
  buildShellyGen1TopicPrefix,
  normalizeShellyGen1DeviceId,
} from "../shelly/topics.js";
import { discoverShellyDevices } from "../telemetry/mqtt.js";
import { getPool } from "../db.js";

function isShellyAlreadyRegistered(
  topicPrefix: string,
  registeredSet: Set<string>
): boolean {
  const lower = topicPrefix.toLowerCase();
  if (registeredSet.has(lower)) return true;
  try {
    const gen1 = buildShellyGen1TopicPrefix(topicPrefix).toLowerCase();
    if (registeredSet.has(gen1)) return true;
  } catch {
    /* ignore */
  }
  const deviceId = normalizeShellyGen1DeviceId(topicPrefix).toLowerCase();
  return registeredSet.has(deviceId);
}

export async function shellyRoutes(app: FastifyInstance) {
  app.get("/api/v1/shelly/models", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    return { models: SHELLY_MODEL_PRESETS };
  });

  app.post("/api/v1/shelly/discover", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;

    const body = (request.body ?? {}) as { timeoutMs?: unknown };
    const timeoutMs =
      typeof body.timeoutMs === "number"
        ? body.timeoutMs
        : typeof body.timeoutMs === "string"
          ? Number(body.timeoutMs)
          : undefined;

    try {
      const { devices, mqttConnected } = await discoverShellyDevices({
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
      });

      if (!mqttConnected) {
        return reply.code(503).send({
          error: {
            code: "mqtt_unavailable",
            message: "MQTT is not connected — cannot discover Shelly devices",
          },
        });
      }

      const registered = await getPool().query<{ mqtt_topic_prefix: string }>(
        `SELECT mqtt_topic_prefix FROM devices
         WHERE COALESCE(firmware_type, 'esphome') = 'shelly'
           AND mqtt_topic_prefix IS NOT NULL AND mqtt_topic_prefix <> ''`
      );
      const registeredSet = new Set(
        registered.rows.map((r) => r.mqtt_topic_prefix.toLowerCase())
      );

      return {
        devices: devices.map((d) => ({
          ...d,
          alreadyRegistered: isShellyAlreadyRegistered(d.topicPrefix, registeredSet),
        })),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Shelly discovery failed";
      return reply.code(500).send({
        error: { code: "discovery_failed", message },
      });
    }
  });
}
