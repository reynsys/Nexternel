import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import {
  AddonError,
  activeAddons,
  addonCode,
  addonsAvailable,
  checkAddons,
  installWithKey,
  listAddons,
  removeAddon,
  serverId,
} from "../addons/service.js";

function fail(reply: FastifyReply, err: unknown) {
  if (err instanceof AddonError) {
    return reply.code(400).send({ error: { code: "addon_error", message: err.message } });
  }
  throw err;
}

/** Settings → Add-ons (admins), and the packs every signed-in browser loads. */
export const addonsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/addons", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    return { available: addonsAvailable(), serverId: await serverId(), addons: await listAddons() };
  });

  app.post<{ Body: { key?: string } }>("/api/v1/addons/install", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    try {
      return { addons: await installWithKey(String(request.body?.key ?? "")) };
    } catch (err) {
      return fail(reply, err);
    }
  });

  app.post("/api/v1/addons/check", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    return { addons: await checkAddons() };
  });

  app.delete<{ Params: { id: string } }>("/api/v1/addons/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    await removeAddon(request.params.id);
    return { addons: await listAddons() };
  });

  // Every signed-in person's browser loads the active packs.
  app.get("/api/v1/addons/active", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: { code: "unauthorized", message: "Authentication required" } });
    return { addons: await activeAddons() };
  });

  app.get<{ Params: { id: string } }>("/api/v1/addons/:id/code", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: { code: "unauthorized", message: "Authentication required" } });
    const code = await addonCode(request.params.id);
    if (!code) return reply.code(404).send({ error: { code: "not_found", message: "This add-on is not active here." } });
    return reply.header("content-type", "text/javascript; charset=utf-8").header("cache-control", "no-store").send(code);
  });
};
