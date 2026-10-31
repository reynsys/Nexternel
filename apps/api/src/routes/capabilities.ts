import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../auth/plugin.js";
import { requirePermission } from "../auth/rbac.js";
import { listCapabilities, getCapabilityById } from "../capabilities/store.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { updateCapabilitySettings } from "../capabilities/settings.js";
import {
  parseStatusSettings,
  resetStatusSettings,
  saveStatusSettings,
  statusEngine,
} from "../capabilities/status-lights.js";
import { getLiveState, getAllLiveStates } from "../telemetry/state-cache.js";
import {
  publishSwitchCommand,
  refreshTelemetrySubscriptions,
} from "../telemetry/mqtt.js";
import { noteSwitchCommand } from "../activity/activity.js";

export const capabilitiesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/capabilities", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const rows = await listCapabilities();
    const live = new Map(getAllLiveStates().map((s) => [s.capabilityId, s]));
    return {
      capabilities: rows.map((c) => {
        const state = live.get(c.id) ?? getLiveState(c.id);
        return {
          id: c.id,
          deviceId: c.device_id,
          deviceName: c.device_name,
          roomId: c.room_id,
          roomName: c.room_name,
          areaId: c.area_id ?? c.room_id,
          systemId: c.system_id,
          groupId: c.group_id,
          serviceId: c.service_id,
          kind: c.kind,
          name: c.name,
          originalName: c.original_name,
          customName: c.custom_name,
          icon: c.icon,
          unit: c.unit,
          sourceType: c.source_type,
          sourceId: c.source_id,
          hasCommand: Boolean(c.command_topic),
          statusLight: statusEngine.get(c.id),
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

  app.post("/api/v1/capabilities/sync", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const { reconcileAllEsphomeDevicesFromYaml } = await import("../devices/service.js");
    const { pruneInternalRelayRows } = await import("../capabilities/cleanup.js");
    const reconcile = await reconcileAllEsphomeDevicesFromYaml();
    const prunedInternal = await pruneInternalRelayRows();
    const result = await syncCapabilitiesFromLegacy();
    const { repairDashboardCapabilityBindings } = await import(
      "../migrate/repair-dashboard-bindings.js"
    );
    const repaired = await repairDashboardCapabilityBindings();
    await refreshTelemetrySubscriptions();
    return {
      ok: true,
      reconcile,
      prunedInternal,
      ...result,
      dashboardBindingsRemapped: repaired.bindingsRemapped,
    };
  });

  /** A reading's own name and icon (null name = back to the device's name; "auto" icon = by kind). */
  app.patch<{
    Params: { id: string };
    Body: { name?: string | null; icon?: string | null };
  }>("/api/v1/capabilities/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    try {
      const ok = await updateCapabilitySettings(request.params.id, {
        name: request.body?.name,
        icon: request.body?.icon,
      });
      if (!ok) return reply.code(404).send({ error: { code: "not_found", message: "Reading not found" } });
      const cap = await getCapabilityById(request.params.id);
      return {
        capability: cap && {
          id: cap.id,
          name: cap.name,
          originalName: cap.original_name,
          customName: cap.custom_name,
          icon: cap.icon,
        },
      };
    } catch (err) {
      return reply.code(400).send({
        error: { code: "validation_error", message: err instanceof Error ? err.message : "Update failed" },
      });
    }
  });

  /** A reading's status light limits. They apply wherever the reading is shown, and to the bell. */
  app.put<{ Params: { id: string }; Body: unknown }>(
    "/api/v1/capabilities/:id/status-limits",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDevices")) return;
      if (!(await getCapabilityById(request.params.id))) {
        return reply.code(404).send({ error: { code: "not_found", message: "Reading not found" } });
      }
      try {
        await saveStatusSettings(request.params.id, parseStatusSettings(request.body));
      } catch (err) {
        return reply.code(400).send({
          error: { code: "validation_error", message: err instanceof Error ? err.message : "Could not save the limits" },
        });
      }
      return { statusLight: statusEngine.get(request.params.id) };
    }
  );

  /** Back to the starting limits for this kind of reading. */
  app.delete<{ Params: { id: string } }>("/api/v1/capabilities/:id/status-limits", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    await resetStatusSettings(request.params.id);
    return { statusLight: statusEngine.get(request.params.id) };
  });

  app.post<{
    Params: { id: string };
    Body: { action?: string };
  }>("/api/v1/capabilities/:id/command", async (request, reply) => {
    if (!requirePermission(request, reply, "controlRelays")) return;
    const action = (request.body?.action ?? "").toLowerCase();
    if (action !== "on" && action !== "off" && action !== "toggle") {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "action must be on, off, or toggle",
        },
      });
    }
    const cap = await getCapabilityById(request.params.id);
    if (!cap) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Capability not found" },
      });
    }
    try {
      const result = await publishSwitchCommand(
        request.params.id,
        action as "on" | "off" | "toggle"
      );
      // The board's answer then says who switched it (Activity log).
      if (typeof result.value === "boolean") noteSwitchCommand(request.params.id, result.value, request.user!.username);
      return { ok: true, value: result.value };
    } catch (err) {
      return reply.code(400).send({
        error: {
          code: "command_failed",
          message: err instanceof Error ? err.message : "Command failed",
        },
      });
    }
  });
};
