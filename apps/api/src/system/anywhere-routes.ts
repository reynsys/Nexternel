import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import {
  AnywhereError,
  anywhereView,
  checkAnywhereName,
  claimAnywhereName,
  readAnywhereSettings,
  waitForLink,
  writeAnywhereSettings,
} from "./anywhere.js";
import { applyHttps } from "./https.js";

/** Settings → System → Nexternel Anywhere. */
export const anywhereRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/system/anywhere", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    return anywhereView();
  });

  app.put<{ Body: { enabled?: boolean } }>("/api/v1/system/anywhere", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const enabled = request.body?.enabled;
    if (typeof enabled !== "boolean") {
      return reply.code(400).send({ error: { code: "bad_request", message: "Say on or off." } });
    }
    const settings = await readAnywhereSettings();
    if (enabled && (!settings.name || !settings.key)) {
      return reply.code(400).send({ error: { code: "not_set_up", message: "Choose your name first." } });
    }
    await writeAnywhereSettings({ ...settings, enabled });
    // Switching on: the link goes through to the door first, then the entrance asks for its padlock.
    if (enabled && settings.name) await waitForLink(settings.name);
    const error = await applyHttps();
    if (error) return reply.code(500).send({ error: { code: "anywhere_failed", message: error } });
    return anywhereView();
  });

  /** Is this name free? (asked while typing) */
  app.get<{ Querystring: { name?: string } }>("/api/v1/system/anywhere/name", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    try {
      return await checkAnywhereName(String(request.query.name ?? ""));
    } catch (e) {
      if (e instanceof AnywhereError) return reply.code(502).send({ error: { code: "anywhere_unreachable", message: e.message } });
      throw e;
    }
  });

  /** Take the name (or change to a new one) and switch on. */
  app.post<{ Body: { name?: string } }>(
    "/api/v1/system/anywhere/name",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageUsers")) return;
      try {
        const name = await claimAnywhereName(String(request.body?.name ?? ""));
        await waitForLink(name);
      } catch (e) {
        if (e instanceof AnywhereError) return reply.code(400).send({ error: { code: "anywhere_name", message: e.message } });
        throw e;
      }
      const error = await applyHttps();
      if (error) return reply.code(500).send({ error: { code: "anywhere_failed", message: error } });
      return anywhereView();
    }
  );
};
