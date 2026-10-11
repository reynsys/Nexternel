import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { refreshTelemetrySubscriptions } from "../telemetry/mqtt.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import { getPool } from "../db.js";
import {
  deleteEsphomeYamlByRelativePath,
  listEsphomeYamlFileEntries,
  suggestFromEsphome,
  type EsphomeImportSuggestion,
} from "../esphome/yaml.js";
import { syncEsphomeYamlConfigStatus } from "../esphome/orphan-prune.js";
import {
  createDevice,
  deleteDevice,
  deleteRelay,
  deleteSensor,
  esphomeSuggestionForDevice,
  getDeviceDetailed,
  listDevicesDetailed,
  renameRelay,
  renameSensor,
  syncDeviceFromEsphomeSuggestion,
  updateDevice,
} from "../devices/service.js";

function pgErrorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "";
}

async function afterDeviceMutation() {
  await syncCapabilitiesFromLegacy();
  const { repairDashboardCapabilityBindings } = await import(
    "../migrate/repair-dashboard-bindings.js"
  );
  await repairDashboardCapabilityBindings();
  await refreshTelemetrySubscriptions();
}

export const devicesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/devices", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const devices = await listDevicesDetailed();
    return { devices };
  });

  app.get("/api/v1/devices/esphome-catalog", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;

    const yamlStatus =
      request.user?.isAdmin ||
      request.user?.role === "admin" ||
      request.user?.permissions?.editDevices
        ? await syncEsphomeYamlConfigStatus()
        : { markedMissing: [] as { id: string; name: string }[], restored: [] as { id: string; name: string }[] };

    const fileEntries = await listEsphomeYamlFileEntries();
    const registered = await getPool().query<{
      esphome_name: string | null;
      slug: string;
      mqtt_topic_prefix: string;
      esphome_yaml_path: string | null;
    }>(`SELECT esphome_name, slug, mqtt_topic_prefix, esphome_yaml_path FROM devices`);

    const configs = await Promise.all(
      fileEntries.map(async ({ stem, relativePath }) => {
        const suggestion = await suggestFromEsphome(stem);
        const esphomeName = suggestion?.esphomeName || stem;
        const mqttTopicPrefix =
          suggestion?.mqttTopicPrefix || `${installationMqttRoot()}/${stem}`;
        const isRegistered = registered.rows.some(
          (d) =>
            d.esphome_yaml_path?.replace(/\\/g, "/") === relativePath ||
            d.esphome_name === esphomeName ||
            d.esphome_name === stem ||
            d.slug === stem ||
            d.mqtt_topic_prefix === mqttTopicPrefix
        );
        return {
          fileName: stem,
          yamlPath: relativePath,
          esphomeName,
          mqttTopicPrefix,
          registered: isRegistered,
          sensorCount: suggestion?.sensors.length ?? 0,
          relayCount: suggestion?.relays.length ?? 0,
          suggestion,
        };
      })
    );

    return {
      configs,
      esphomeDirHint:
        fileEntries.length === 0
          ? "No YAML files found in /esphome — create a device in ESPHome Builder first, then ensure the esphome/ folder is on the server."
          : null,
      yamlStatus,
      /** @deprecated use yamlStatus.markedMissing */
      pruned: yamlStatus.markedMissing,
    };
  });

  app.delete("/api/v1/devices/esphome-yaml", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const q = request.query as { path?: string };
    const yamlPath = typeof q.path === "string" ? q.path.trim() : "";
    if (!yamlPath) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "path query is required" },
      });
    }

    const removed = await deleteEsphomeYamlByRelativePath(yamlPath);
    if (!removed) {
      return reply.code(404).send({
        error: { code: "not_found", message: "YAML file not found on server" },
      });
    }
    return { ok: true, yamlPath };
  });

  app.get("/api/v1/devices/esphome-suggest", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const q = request.query as { name?: string };
    const name = typeof q.name === "string" ? q.name.trim() : "";
    if (!name) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "name query is required" },
      });
    }
    const suggestion = await suggestFromEsphome(name);
    if (!suggestion) {
      return reply.code(404).send({
        error: { code: "not_found", message: "ESPHome YAML not found" },
      });
    }
    return suggestion;
  });

  app.post("/api/v1/devices", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;

    const body = (request.body ?? {}) as {
      name?: unknown;
      roomId?: unknown;
      mqttTopicPrefix?: unknown;
      esphomeName?: unknown;
      firmwareType?: unknown;
      shellyChannel?: unknown;
      shellySwitchCount?: unknown;
      shellyModelId?: unknown;
      shellyGen?: unknown;
      ipAddress?: unknown;
      macAddress?: unknown;
      sensors?: EsphomeImportSuggestion["sensors"];
      relays?: EsphomeImportSuggestion["relays"];
    };

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const mqttTopicPrefix =
      typeof body.mqttTopicPrefix === "string" ? body.mqttTopicPrefix.trim() : "";
    if (!name || !mqttTopicPrefix) {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "Name and MQTT topic prefix are required",
        },
      });
    }

    const firmwareType =
      typeof body.firmwareType === "string"
        ? body.firmwareType.trim().toLowerCase()
        : "esphome";
    if (firmwareType !== "esphome" && firmwareType !== "shelly") {
      return reply.code(400).send({
        error: {
          code: "validation_error",
          message: "firmwareType must be esphome or shelly",
        },
      });
    }

    const shellyChannel =
      typeof body.shellyChannel === "number"
        ? body.shellyChannel
        : typeof body.shellyChannel === "string"
          ? Number(body.shellyChannel)
          : 0;

    const shellySwitchCount =
      typeof body.shellySwitchCount === "number"
        ? body.shellySwitchCount
        : typeof body.shellySwitchCount === "string"
          ? Number(body.shellySwitchCount)
          : undefined;

    const shellyModelId =
      typeof body.shellyModelId === "string" ? body.shellyModelId.trim() : null;

    const shellyGenRaw =
      typeof body.shellyGen === "number"
        ? body.shellyGen
        : typeof body.shellyGen === "string"
          ? Number(body.shellyGen)
          : undefined;
    const shellyGen =
      shellyGenRaw === 1 || shellyGenRaw === 2 ? shellyGenRaw : undefined;

    try {
      const device = await createDevice({
        name,
        roomId: typeof body.roomId === "string" ? body.roomId : null,
        mqttTopicPrefix,
        esphomeName: typeof body.esphomeName === "string" ? body.esphomeName : null,
        firmwareType,
        shellyChannel: Number.isFinite(shellyChannel) ? shellyChannel : 0,
        shellySwitchCount: Number.isFinite(shellySwitchCount as number)
          ? (shellySwitchCount as number)
          : undefined,
        shellyModelId,
        shellyGen,
        ipAddress: typeof body.ipAddress === "string" ? body.ipAddress : null,
        macAddress: typeof body.macAddress === "string" ? body.macAddress : null,
        sensors: Array.isArray(body.sensors) ? body.sensors : [],
        relays: Array.isArray(body.relays) ? body.relays : [],
      });
      await afterDeviceMutation();
      return reply.code(201).send({ device });
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        return reply.code(409).send({
          error: {
            code: "conflict",
            message: "A device with that slug or MQTT prefix already exists",
          },
        });
      }
      const message = err instanceof Error ? err.message : "Failed to create device";
      return reply.code(400).send({
        error: { code: "validation_error", message },
      });
    }
  });

  app.patch("/api/v1/devices/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;

    try {
      const device = await updateDevice(id, {
        name: typeof body.name === "string" ? body.name : undefined,
        roomId:
          body.roomId === null
            ? null
            : typeof body.roomId === "string"
              ? body.roomId
              : undefined,
        mqttTopicPrefix:
          typeof body.mqttTopicPrefix === "string" ? body.mqttTopicPrefix : undefined,
        esphomeName:
          body.esphomeName === null
            ? null
            : typeof body.esphomeName === "string"
              ? body.esphomeName
              : undefined,
        ipAddress:
          body.ipAddress === null
            ? null
            : typeof body.ipAddress === "string"
              ? body.ipAddress
              : undefined,
        macAddress:
          body.macAddress === null
            ? null
            : typeof body.macAddress === "string"
              ? body.macAddress
              : undefined,
        isEnabled: typeof body.isEnabled === "boolean" ? body.isEnabled : undefined,
      });
      if (!device) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Device not found" },
        });
      }
      await afterDeviceMutation();
      return { device };
    } catch (err) {
      if (pgErrorCode(err) === "23505") {
        return reply.code(409).send({
          error: { code: "conflict", message: "Device name/slug conflict" },
        });
      }
      const message = err instanceof Error ? err.message : "Failed to update device";
      return reply.code(400).send({
        error: { code: "validation_error", message },
      });
    }
  });

  app.delete("/api/v1/devices/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { id } = request.params as { id: string };
    const q = request.query as { deleteYaml?: string };
    let deleteYaml: boolean | undefined;
    if (q.deleteYaml === "true") deleteYaml = true;
    else if (q.deleteYaml === "false") deleteYaml = false;
    const ok = await deleteDevice(id, { deleteYaml });
    if (!ok) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Device not found" },
      });
    }
    await afterDeviceMutation();
    return { ok: true };
  });

  app.post("/api/v1/devices/:id/sync-esphome", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { id } = request.params as { id: string };
    const device = await getDeviceDetailed(id);
    if (!device) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Device not found" },
      });
    }

    const suggestion = await esphomeSuggestionForDevice(device);
    if (!suggestion) {
      return reply.code(404).send({
        error: {
          code: "not_found",
          message: "ESPHome YAML not found for this device",
        },
      });
    }

    const stats = await syncDeviceFromEsphomeSuggestion(id, suggestion);
    await afterDeviceMutation();
    const updated = await getDeviceDetailed(id);
    return {
      ...stats,
      yamlFile: suggestion.yamlFile,
      mqttTopicPrefix: suggestion.mqttTopicPrefix,
      relaysInYaml: suggestion.relays.map((r) => r.name),
      sensorsInYaml: suggestion.sensors.map((s) => s.name),
      isOnline: updated?.isOnline ?? false,
      device: updated,
    };
  });

  app.delete("/api/v1/devices/:deviceId/sensors/:sensorId", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { deviceId, sensorId } = request.params as {
      deviceId: string;
      sensorId: string;
    };
    const ok = await deleteSensor(deviceId, sensorId);
    if (!ok) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Sensor not found" },
      });
    }
    await afterDeviceMutation();
    return { ok: true };
  });

  app.delete("/api/v1/devices/:deviceId/relays/:relayId", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { deviceId, relayId } = request.params as {
      deviceId: string;
      relayId: string;
    };
    const ok = await deleteRelay(deviceId, relayId);
    if (!ok) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Relay not found" },
      });
    }
    await afterDeviceMutation();
    return { ok: true };
  });

  app.patch("/api/v1/devices/:deviceId/relays/:relayId", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { deviceId, relayId } = request.params as {
      deviceId: string;
      relayId: string;
    };
    const body = (request.body ?? {}) as { name?: unknown };
    if (typeof body.name !== "string") {
      return reply.code(400).send({
        error: { code: "validation_error", message: "name is required" },
      });
    }
    const owned = await getPool().query(
      `SELECT id FROM relays WHERE id = $1 AND device_id = $2`,
      [relayId, deviceId]
    );
    if (owned.rowCount === 0) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Relay not found" },
      });
    }
    try {
      await renameRelay(relayId, body.name);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rename failed";
      return reply.code(400).send({
        error: { code: "validation_error", message },
      });
    }
  });

  app.patch("/api/v1/devices/:deviceId/sensors/:sensorId", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { deviceId, sensorId } = request.params as {
      deviceId: string;
      sensorId: string;
    };
    const body = (request.body ?? {}) as { name?: unknown };
    if (typeof body.name !== "string") {
      return reply.code(400).send({
        error: { code: "validation_error", message: "name is required" },
      });
    }
    const owned = await getPool().query(
      `SELECT id FROM sensors WHERE id = $1 AND device_id = $2`,
      [sensorId, deviceId]
    );
    if (owned.rowCount === 0) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Sensor not found" },
      });
    }
    try {
      await renameSensor(sensorId, body.name);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rename failed";
      return reply.code(400).send({
        error: { code: "validation_error", message },
      });
    }
  });
};
