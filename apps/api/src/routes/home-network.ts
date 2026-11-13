import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import type { FoundDevice } from "@nexternel/domain";
import { HomeNetworkSearchUnavailable, searchHomeNetwork } from "../home-network/search.js";
import { BringInRefused, bringInFoundDevice } from "../home-network/bring-in.js";
import { ShellyPasswordNeeded, ShellyUnreachable } from "../home-network/shelly-local.js";

export async function homeNetworkRoutes(app: FastifyInstance) {
  /** Devices → Add device → Search my home. Only listens and asks "who is there"; changes nothing. */
  app.post("/api/v1/home-network/search", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    try {
      return { devices: await searchHomeNetwork() };
    } catch (err) {
      if (err instanceof HomeNetworkSearchUnavailable) {
        return reply.code(409).send({
          error: {
            code: "search_unavailable",
            message: "Nexternel's home network search isn't running. Try again in a minute. If it keeps happening, press Restart Nexternel in Settings → System.",
          },
        });
      }
      request.log.error({ err }, "home network search failed");
      return reply.code(500).send({
        error: { code: "search_failed", message: "The search of your home network didn't finish. Try again." },
      });
    }
  });

  /** Search my home → Bring in one found device. */
  app.post("/api/v1/home-network/bring-in", async (request, reply) => {
    if (!requirePermission(request, reply, "editDevices")) return;
    const body = (request.body ?? {}) as { device?: FoundDevice; password?: unknown };
    const device = body.device;
    if (!device || typeof device !== "object" || typeof device.kind !== "string") {
      return reply.code(400).send({ error: { code: "validation_error", message: "Which device? Search again." } });
    }
    const password = typeof body.password === "string" && body.password ? body.password : undefined;
    try {
      return await bringInFoundDevice(device, { password });
    } catch (err) {
      if (err instanceof ShellyPasswordNeeded) {
        // Not 401: that would look like being signed out of Nexternel.
        return reply.code(422).send({ error: { code: "device_password_needed", message: err.message } });
      }
      if (err instanceof BringInRefused) {
        return reply.code(409).send({ error: { code: err.code, message: err.message } });
      }
      if (err instanceof ShellyUnreachable) {
        return reply.code(409).send({ error: { code: "bring_in_refused", message: err.message } });
      }
      request.log.error({ err }, "bring in failed");
      const message = err instanceof Error ? err.message : "Bringing it in didn't work. Try again.";
      return reply.code(500).send({ error: { code: "bring_in_failed", message } });
    }
  });
}
