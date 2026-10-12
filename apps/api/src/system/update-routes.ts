import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { checkForUpdate, dismissUpdateRun, downloadUpdate, startUpdate, updateStatus } from "./updates.js";

export const updateRoutes: FastifyPluginAsync = async (app) => {
  const failed = (err: unknown) => ({
    error: { code: "update_failed", message: err instanceof Error ? err.message : "Something went wrong" },
  });

  app.get("/api/v1/system/update", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    return updateStatus();
  });

  app.post("/api/v1/system/update/check", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    return checkForUpdate();
  });

  app.post("/api/v1/system/update/download", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    try {
      return await downloadUpdate();
    } catch (err) {
      return reply.code(400).send(failed(err));
    }
  });

  app.post("/api/v1/system/update/start", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    try {
      return await startUpdate();
    } catch (err) {
      return reply.code(400).send(failed(err));
    }
  });

  app.post("/api/v1/system/update/dismiss", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    try {
      return await dismissUpdateRun();
    } catch (err) {
      return reply.code(400).send(failed(err));
    }
  });
};
