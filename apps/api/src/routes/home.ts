import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../auth/plugin.js";
import { readAnywhereSettings } from "../system/anywhere.js";

/**
 * The home as a whole: its name, shown in the browser tab. The home's name is its Nexternel
 * Anywhere name (Extensions → Nexternel Anywhere); without Anywhere it has none.
 */
export const homeRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/home", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const anywhere = await readAnywhereSettings();
    return { home: { name: anywhere.name && anywhere.key ? anywhere.name : "" } };
  });
};
