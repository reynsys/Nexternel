import type { FastifyPluginAsync } from "fastify";
import {
  isSystemId,
  type SystemId,
} from "@nexternel/domain";
import { requirePermission } from "../auth/rbac.js";
import { requireUser } from "../auth/plugin.js";
import { getCapabilityById, updateCapabilitySystemId } from "../capabilities/store.js";
import { getPool } from "../db.js";
import { classifyAllCapabilities } from "../capabilities/classify.js";
import {
  onboardEsphomeDevice,
  previewEsphomeOnboarding,
} from "./device-registry.js";
import {
  builderCatalogPayload,
  adoptEsphomeDeviceToManaged,
  createManagedEsphomeDevice,
  getManagedBuilderConfig,
  previewManagedEsphomeDevice,
  restoreManagedEsphomeYaml,
  updateManagedEsphomeDevice,
} from "../esphome/builder/registry.js";
import { validateEsphomeBuilderConfig } from "../esphome/builder/validate.js";
import {
  compileEsphomeDevice,
  readCompiledFirmware,
  readDeviceEsphomeYaml,
  saveDeviceEsphomeYaml,
  uploadEsphomeDevice,
  validateDeviceEsphomeYaml,
} from "../esphome/builder/firmware.js";
import { checkEsphomeBuildPrerequisites } from "../esphome/secrets.js";
import {
  catalogRowsForSystemIds,
  listAllCatalogSystems,
  listSystemIdsInScope,
  parseAreaIdsQuery,
} from "./systems-in-scope.js";

export const v4Routes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/v4/systems", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const q = request.query as Record<string, unknown>;
    const catalog = q.catalog === "1" || q.catalog === "true";
    if (catalog) {
      return { systems: listAllCatalogSystems() };
    }
    const areaIds = parseAreaIdsQuery(q);
    const inScope = await listSystemIdsInScope(areaIds);
    return { systems: catalogRowsForSystemIds(inScope) };
  });

  app.get("/api/v1/v4/devices/esphome/preview", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const q = request.query as { yamlName?: string; roomId?: string };
    const yamlName = typeof q.yamlName === "string" ? q.yamlName.trim() : "";
    if (!yamlName) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "yamlName query is required" },
      });
    }
    const roomId =
      typeof q.roomId === "string" && q.roomId.trim() ? q.roomId.trim() : null;
    const preview = await previewEsphomeOnboarding(yamlName, roomId);
    if (!preview) {
      return reply.code(404).send({
        error: { code: "not_found", message: "ESPHome YAML not found" },
      });
    }
    return preview;
  });

  app.post<{
    Body: {
      yamlName?: string;
      name?: string;
      roomId?: string | null;
      deviceId?: string;
      systemOverrides?: Record<string, string>;
    };
  }>("/api/v1/v4/devices/onboard/esphome", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;

    const yamlName =
      typeof request.body?.yamlName === "string"
        ? request.body.yamlName.trim()
        : "";
    if (!yamlName) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "yamlName is required" },
      });
    }

    const systemOverrides: Record<string, string> = {};
    const rawOverrides = request.body?.systemOverrides;
    if (rawOverrides && typeof rawOverrides === "object") {
      for (const [key, value] of Object.entries(rawOverrides)) {
        if (typeof value === "string" && isSystemId(value)) {
          systemOverrides[key] = value;
        }
      }
    }

    try {
      const result = await onboardEsphomeDevice({
        yamlName,
        name: request.body?.name,
        roomId: request.body?.roomId,
        deviceId: request.body?.deviceId,
        systemOverrides: systemOverrides as Record<string, SystemId>,
      });
      return { ok: true, ...result };
    } catch (err) {
      return reply.code(400).send({
        error: {
          code: "onboard_failed",
          message: err instanceof Error ? err.message : "Onboard failed",
        },
      });
    }
  });

  app.get("/api/v1/v4/devices/esphome/builder/catalog", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    return builderCatalogPayload();
  });

  app.post<{ Body: { config?: unknown } }>(
    "/api/v1/v4/devices/esphome/builder/validate",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewDevices")) return;
      const validation = validateEsphomeBuilderConfig(request.body?.config);
      return { ok: validation.valid, ...validation };
    }
  );

  app.post<{ Body: { config?: unknown; roomId?: string | null } }>(
    "/api/v1/v4/devices/esphome/builder/preview",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewDevices")) return;
      const roomId =
        typeof request.body?.roomId === "string" && request.body.roomId.trim()
          ? request.body.roomId.trim()
          : null;
      const preview = await previewManagedEsphomeDevice(
        request.body?.config,
        roomId
      );
      return { ok: preview.validation.valid, ...preview };
    }
  );

  app.post<{
    Body: {
      config?: unknown;
      roomId?: string | null;
      systemOverrides?: Record<string, string>;
    };
  }>("/api/v1/v4/devices/esphome/builder/create", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;

    const systemOverrides: Record<string, string> = {};
    const rawOverrides = request.body?.systemOverrides;
    if (rawOverrides && typeof rawOverrides === "object") {
      for (const [key, value] of Object.entries(rawOverrides)) {
        if (typeof value === "string" && isSystemId(value)) {
          systemOverrides[key] = value;
        }
      }
    }

    try {
      const result = await createManagedEsphomeDevice({
        config: request.body?.config,
        roomId: request.body?.roomId,
        systemOverrides: systemOverrides as Record<string, SystemId>,
      });
      return { ok: true, ...result };
    } catch (err) {
      return reply.code(400).send({
        error: {
          code: "builder_create_failed",
          message: err instanceof Error ? err.message : "Create failed",
        },
      });
    }
  });

  app.get<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/builder-config",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        const config = await getManagedBuilderConfig(deviceId);
        return { ok: true, config };
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "builder_config_failed",
            message: err instanceof Error ? err.message : "Load failed",
          },
        });
      }
    }
  );

  app.put<{
    Params: { deviceId: string };
    Body: {
      config?: unknown;
      roomId?: string | null;
      systemOverrides?: Record<string, string>;
    };
  }>("/api/v1/v4/devices/esphome/:deviceId/builder", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const deviceId = request.params.deviceId?.trim();
    if (!deviceId) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "deviceId is required" },
      });
    }

    const systemOverrides: Record<string, string> = {};
    const rawOverrides = request.body?.systemOverrides;
    if (rawOverrides && typeof rawOverrides === "object") {
      for (const [key, value] of Object.entries(rawOverrides)) {
        if (typeof value === "string" && isSystemId(value)) {
          systemOverrides[key] = value;
        }
      }
    }

    try {
      const result = await updateManagedEsphomeDevice({
        deviceId,
        config: request.body?.config,
        roomId: request.body?.roomId,
        systemOverrides: systemOverrides as Record<string, SystemId>,
      });
      return { ok: true, ...result };
    } catch (err) {
      return reply.code(400).send({
        error: {
          code: "builder_update_failed",
          message: err instanceof Error ? err.message : "Update failed",
        },
      });
    }
  });

  app.post<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/adopt-managed",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        const result = await adoptEsphomeDeviceToManaged(deviceId);
        return { ok: true, ...result };
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "adopt_managed_failed",
            message: err instanceof Error ? err.message : "Adopt failed",
          },
        });
      }
    }
  );

  app.post<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/restore-yaml",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        const result = await restoreManagedEsphomeYaml(deviceId);
        return { ok: true, ...result };
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "restore_yaml_failed",
            message: err instanceof Error ? err.message : "Restore failed",
          },
        });
      }
    }
  );

  app.get<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/yaml",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      const result = await readDeviceEsphomeYaml(deviceId);
      if (!result) {
        return reply.code(404).send({
          error: { code: "not_found", message: "ESPHome YAML not found for this device" },
        });
      }
      return result;
    }
  );

  app.get(
    "/api/v1/v4/devices/esphome/build-prerequisites",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewDevices")) return;
      return checkEsphomeBuildPrerequisites();
    }
  );

  app.post<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/compile",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        const result = await compileEsphomeDevice(deviceId);
        return result;
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "compile_failed",
            message: err instanceof Error ? err.message : "Compile failed",
          },
        });
      }
    }
  );

  app.get<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/firmware",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        const firmware = await readCompiledFirmware(deviceId);
        if (!firmware) {
          return reply.code(404).send({
            error: {
              code: "firmware_not_found",
              message: "Firmware not found — click Build firmware first.",
            },
          });
        }
        return reply
          .header("Content-Type", "application/octet-stream")
          .header(
            "Content-Disposition",
            `attachment; filename="${firmware.filename}"`
          )
          .send(firmware.buffer);
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "firmware_download_failed",
            message: err instanceof Error ? err.message : "Firmware download failed",
          },
        });
      }
    }
  );

  app.put<{ Params: { deviceId: string }; Body: { yaml?: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/yaml",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      const yaml = typeof request.body?.yaml === "string" ? request.body.yaml : "";
      if (!deviceId || !yaml.trim()) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId and yaml are required" },
        });
      }
      try {
        const result = await saveDeviceEsphomeYaml(deviceId, yaml);
        if (!result.ok) {
          return reply.code(400).send({
            error: { code: "yaml_invalid", message: "YAML validation failed" },
            ...result,
          });
        }
        return result;
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "yaml_save_failed",
            message: err instanceof Error ? err.message : "Save failed",
          },
        });
      }
    }
  );

  app.post<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/yaml/validate",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        return await validateDeviceEsphomeYaml(deviceId);
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "validate_failed",
            message: err instanceof Error ? err.message : "Validate failed",
          },
        });
      }
    }
  );

  app.post<{ Params: { deviceId: string } }>(
    "/api/v1/v4/devices/esphome/:deviceId/upload",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      const deviceId = request.params.deviceId?.trim();
      if (!deviceId) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "deviceId is required" },
        });
      }
      try {
        return await uploadEsphomeDevice(deviceId);
      } catch (err) {
        return reply.code(400).send({
          error: {
            code: "upload_failed",
            message: err instanceof Error ? err.message : "Upload failed",
          },
        });
      }
    }
  );

  app.post("/api/v1/v4/capabilities/classify", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const classified = await classifyAllCapabilities();
    return { ok: true, classified };
  });

  app.get("/api/v1/v4/capabilities", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const result = await getPool().query<{
      id: string;
      device_id: string;
      device_name: string;
      kind: string;
      name: string;
      icon: string | null;
      unit: string | null;
      system_id: string | null;
      area_id: string | null;
      group_id: string | null;
      service_id: string | null;
      area_name: string | null;
      state_topic: string | null;
    }>(
      `SELECT c.id, c.device_id, d.name AS device_name,
              c.kind, COALESCE(NULLIF(c.custom_name, ''), c.name) AS name, c.icon, c.unit,
              c.system_id, c.area_id, c.group_id, c.service_id,
              r.name AS area_name,
              b.state_topic
       FROM capabilities c
       JOIN devices d ON d.id = c.device_id
       LEFT JOIN rooms r ON r.id = c.area_id
       LEFT JOIN capability_bindings b ON b.capability_id = c.id
       WHERE c.is_enabled = TRUE
         AND COALESCE(d.is_enabled, TRUE) = TRUE
       ORDER BY COALESCE(r.name, ''), d.name ASC, COALESCE(NULLIF(c.custom_name, ''), c.name) ASC`
    );

    const { getAllLiveStates, getLiveState } = await import(
      "../telemetry/state-cache.js"
    );
    const live = new Map(getAllLiveStates().map((s) => [s.capabilityId, s]));

    return {
      capabilities: result.rows.map((c) => {
        const state = live.get(c.id) ?? getLiveState(c.id);
        return {
          id: c.id,
          deviceId: c.device_id,
          deviceName: c.device_name,
          kind: c.kind,
          name: c.name,
          icon: c.icon,
          unit: c.unit,
          systemId: c.system_id,
          areaId: c.area_id,
          groupId: c.group_id,
          serviceId: c.service_id,
          areaName: c.area_name,
          stateTopic: c.state_topic,
          state: state
            ? {
                value: state.value,
                quality: state.quality,
                updatedAt: state.updatedAt,
              }
            : null,
        };
      }),
    };
  });

  app.patch<{
    Params: { id: string };
    Body: { systemId?: string | null };
  }>("/api/v1/v4/capabilities/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const capabilityId = request.params.id?.trim();
    if (!capabilityId) {
      return reply.code(400).send({
        error: { code: "validation_error", message: "Capability id is required" },
      });
    }
    const cap = await getCapabilityById(capabilityId);
    if (!cap) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Capability not found" },
      });
    }
    const raw = request.body?.systemId;
    let systemId: string | null = null;
    if (raw !== undefined && raw !== null && raw !== "") {
      if (typeof raw !== "string" || !isSystemId(raw)) {
        return reply.code(400).send({
          error: { code: "validation_error", message: "Invalid systemId" },
        });
      }
      systemId = raw;
    }
    const updated = await updateCapabilitySystemId(capabilityId, systemId);
    if (!updated) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Capability not found" },
      });
    }
    return { ok: true, systemId };
  });
};
