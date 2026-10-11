import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { triggerOctopusPoll, triggerOctopusTestPoll } from "../octopus/poll.js";
import { getLiveState } from "../telemetry/state-cache.js";
import {
  discoverOctopusDeviceIds,
  getOctopusSettings,
  listOctopusCapabilityIds,
  maskOctopusSettings,
  updateOctopusSettings,
} from "../octopus/service.js";

export async function octopusRoutes(app: FastifyInstance) {
  app.get("/api/v1/octopus/settings", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const row = await getOctopusSettings();
    return { settings: await maskOctopusSettings(row) };
  });

  app.put("/api/v1/octopus/settings", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;

    const body = (request.body ?? {}) as {
      accountNumber?: unknown;
      apiKey?: unknown;
      electricityDeviceId?: unknown;
      gasDeviceId?: unknown;
      enabled?: unknown;
      pollIntervalSec?: unknown;
    };

    const pollIntervalSec =
      typeof body.pollIntervalSec === "number"
        ? body.pollIntervalSec
        : typeof body.pollIntervalSec === "string"
          ? Number(body.pollIntervalSec)
          : undefined;

    try {
      const settings = await updateOctopusSettings({
        accountNumber:
          typeof body.accountNumber === "string" ? body.accountNumber : undefined,
        apiKey:
          body.apiKey === null
            ? ""
            : typeof body.apiKey === "string"
              ? body.apiKey
              : undefined,
        electricityDeviceId:
          typeof body.electricityDeviceId === "string"
            ? body.electricityDeviceId
            : undefined,
        gasDeviceId:
          typeof body.gasDeviceId === "string" ? body.gasDeviceId : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        pollIntervalSec: Number.isFinite(pollIntervalSec) ? pollIntervalSec : undefined,
      });
      if (settings.enabled) {
        await triggerOctopusPoll(true, { includeDaily: true });
        const refreshed = await getOctopusSettings();
        return { settings: await maskOctopusSettings(refreshed) };
      }
      return { settings };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save Octopus settings";
      return reply.code(400).send({
        error: { code: "validation_error", message },
      });
    }
  });

  app.post("/api/v1/octopus/discover-device", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    try {
      const result = await discoverOctopusDeviceIds();
      const row = await getOctopusSettings();
      return {
        electricityDeviceId: result.electricityDeviceId,
        gasDeviceId: result.gasDeviceId,
        settings: await maskOctopusSettings(row),
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to discover meter device IDs";
      return reply.code(400).send({
        error: { code: "discover_failed", message },
      });
    }
  });

  app.post("/api/v1/octopus/test-poll", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const settings = await getOctopusSettings();
    if (!settings?.api_key.trim() || !settings.account_number.trim()) {
      return reply.code(400).send({
        error: { code: "not_configured", message: "Account and API key required" },
      });
    }
    const result = await triggerOctopusTestPoll();
    const caps = await listOctopusCapabilityIds();
    const row = await getOctopusSettings();

    if (!result.ok && !result.cooldown) {
      return reply.code(400).send({
        error: { code: "poll_failed", message: result.error ?? "Test poll failed" },
      });
    }

    return {
      liveDemandW: result.liveDemandW,
      electricityTodayKwh: result.electricityTodayKwh,
      gasTodayKwh: result.gasTodayKwh,
      cooldown: result.cooldown ?? false,
      liveStates: {
        power: caps.powerCapabilityId
          ? getLiveState(caps.powerCapabilityId)?.value
          : null,
        electricityToday: caps.energyTodayCapabilityId
          ? getLiveState(caps.energyTodayCapabilityId)?.value
          : null,
        gasToday: caps.gasTodayCapabilityId
          ? getLiveState(caps.gasTodayCapabilityId)?.value
          : null,
      },
      settings: await maskOctopusSettings(row),
      message: result.cooldown ? result.error : undefined,
    };
  });
}
