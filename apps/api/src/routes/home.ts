import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../auth/plugin.js";
import { requireAdmin } from "../auth/rbac.js";
import { getHome, setHome } from "../system/home.js";

/** The home as a whole: its name (browser tab; Settings → System). Set first in the setup wizard. */
export const homeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/home", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    return { home: await getHome() };
  });

  app.put<{ Body: { name?: unknown } }>("/api/v1/home", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    return { home: await setHome({ name: request.body?.name }) };
  });
};
