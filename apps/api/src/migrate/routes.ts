import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../auth/rbac.js";
import { config } from "../config.js";
import { isDirectory, esphomeDir } from "./paths.js";
import { createConfigExport } from "./export-config.js";
import {
  adoptConfigArchive,
  createEsphomeCutoverPack,
} from "./adopt-config.js";
import {
  createFlashReadyPack,
  createFlashReadyYamlForStem,
} from "./flash-yaml.js";
import { repairDashboardCapabilityBindings } from "./repair-dashboard-bindings.js";
import { refreshTelemetrySubscriptions } from "../telemetry/mqtt.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";

const MAX_CONFIG_BYTES = 50 * 1024 * 1024; // 50 MB — enforced in adopt handler if needed

export const migrateRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/system/config/status", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return {
      currentServerIp: config.serverIp() || null,
      mqttTopicPrefix: process.env.MQTT_TOPIC_PREFIX?.trim() || "nexternel",
      esphomeMounted: isDirectory(esphomeDir()),
      ready: true,
    };
  });

  app.post("/api/v1/system/config/repair-dashboard-bindings", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      await syncCapabilitiesFromLegacy();
      const result = await repairDashboardCapabilityBindings();
      await refreshTelemetrySubscriptions();
      return { ok: true, ...result };
    } catch (err) {
      request.log.error({ err }, "repair dashboard bindings failed");
      return reply.code(400).send({
        error: {
          code: "repair_failed",
          message: err instanceof Error ? err.message : "Repair failed",
        },
      });
    }
  });

  app.get("/api/v1/system/config/export", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      const { buffer, filename, manifest, counts } = await createConfigExport();
      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("X-Nexternel-Config-Version", String(manifest.formatVersion))
        .header("X-Nexternel-Config-Counts", JSON.stringify(counts))
        .send(buffer);
    } catch (err) {
      request.log.error({ err }, "config export failed");
      return reply.code(500).send({
        error: {
          code: "export_failed",
          message: err instanceof Error ? err.message : "Export failed",
        },
      });
    }
  });

  app.get("/api/v1/system/config/esphome-pack", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    try {
      // Prefer flash-ready (IP/Wi‑Fi inlined). Fall back to raw YAML zip.
      try {
        const { buffer, filename } = await createFlashReadyPack();
        return reply
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(buffer);
      } catch (flashErr) {
        request.log.warn({ err: flashErr }, "flash-ready pack failed; raw cutover");
        const { buffer, filename } = await createEsphomeCutoverPack();
        return reply
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(buffer);
      }
    } catch (err) {
      request.log.error({ err }, "esphome pack failed");
      return reply.code(400).send({
        error: {
          code: "esphome_pack_failed",
          message: err instanceof Error ? err.message : "ESPHome pack failed",
        },
      });
    }
  });

  /** Single device YAML with this server's broker IP / Wi‑Fi / MQTT inlined. */
  app.get<{ Params: { stem: string } }>(
    "/api/v1/system/config/flash-yaml/:stem",
    async (request, reply) => {
      if (!requireAdmin(request, reply)) return;
      try {
        const { yaml, filename, brokerIp, topicPrefix } =
          await createFlashReadyYamlForStem(request.params.stem);
        return reply
          .header("Content-Type", "text/yaml; charset=utf-8")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .header("X-Nexternel-Broker-Ip", brokerIp)
          .header("X-Nexternel-Topic-Prefix", topicPrefix)
          .send(yaml);
      } catch (err) {
        request.log.error({ err }, "flash yaml failed");
        return reply.code(400).send({
          error: {
            code: "flash_yaml_failed",
            message: err instanceof Error ? err.message : "Flash YAML failed",
          },
        });
      }
    }
  );

  app.post("/api/v1/system/config/adopt", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;

    try {
      let newBrokerIp = config.serverIp() || "";
      let newTopicRoot = (process.env.MQTT_TOPIC_PREFIX || "nexternel").trim();
      let wifiSsid = "";
      let wifiPassword = "";
      let confirm = "";
      let fileBuffer: Buffer | null = null;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          if (part.fieldname !== "file") {
            await part.toBuffer();
            continue;
          }
          fileBuffer = await part.toBuffer();
        } else {
          const value = String(part.value ?? "");
          if (part.fieldname === "newBrokerIp") newBrokerIp = value;
          if (part.fieldname === "newTopicRoot") newTopicRoot = value;
          if (part.fieldname === "wifiSsid") wifiSsid = value;
          if (part.fieldname === "wifiPassword") wifiPassword = value;
          if (part.fieldname === "confirm") confirm = value;
        }
      }

      if (!fileBuffer?.length) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "Configuration .nexcfg file is required",
          },
        });
      }

      const result = await adoptConfigArchive(fileBuffer, {
        newBrokerIp,
        newTopicRoot,
        wifiSsid: wifiSsid || undefined,
        wifiPassword: wifiPassword || undefined,
        confirm,
      });
      return result;
    } catch (err) {
      request.log.error({ err }, "config adopt failed");
      return reply.code(400).send({
        error: {
          code: "adopt_failed",
          message: err instanceof Error ? err.message : "Adopt failed",
        },
      });
    }
  });
};
