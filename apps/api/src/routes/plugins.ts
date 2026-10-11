import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import {
  installPluginManifest,
  listPluginRecords,
  removePlugin,
  setPluginEnabled,
} from "../plugins/service.js";
import { validatePluginManifest } from "../plugins/validate.js";

export const pluginsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/plugins", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const plugins = await listPluginRecords();
    return { plugins };
  });

  app.patch<{ Params: { id: string }; Body: { enabled?: boolean } }>(
    "/api/v1/plugins/:id",
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageUsers")) return;

      const enabled = request.body?.enabled;
      if (typeof enabled !== "boolean") {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "enabled (boolean) is required",
          },
        });
      }

      const plugin = await setPluginEnabled(request.params.id, enabled);
      if (!plugin) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Plugin not found" },
        });
      }
      return { plugin };
    }
  );

  app.post<{ Body: { manifest?: unknown; packagePath?: string } }>(
    "/api/v1/plugins/install",
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageUsers")) return;

      const result = await installPluginManifest(
        request.body?.manifest,
        request.body?.packagePath ?? null
      );
      if (!result.ok) {
        return reply.code(400).send({
          error: {
            code: "validation_error",
            message: result.errors.join("; "),
          },
        });
      }
      return result;
    }
  );

  app.post<{ Body: { manifest?: unknown } }>(
    "/api/v1/plugins/validate",
    async (request, reply) => {
      if (!requirePermission(request, reply, "viewSystem")) return;
      const result = validatePluginManifest(request.body?.manifest);
      if (!result.ok) {
        return reply.code(400).send({ ok: false, errors: result.errors });
      }
      return { ok: true, manifest: result.manifest };
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/plugins/:id",
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageUsers")) return;

      const removed = await removePlugin(request.params.id);
      if (!removed) {
        return reply.code(404).send({
          error: {
            code: "not_found",
            message: "Plugin not found or cannot be removed (built-in)",
          },
        });
      }
      return { ok: true };
    }
  );
};
