import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { PluginGrants } from "@nexternel/plugin-sdk";
import { requirePermission } from "../auth/rbac.js";
import { catalogUrl, OFFICIAL_CATALOG_URL } from "../plugins/packages.js";
import { pluginHostLastContact } from "../plugins/host-routes.js";
import {
  getPluginRecord,
  installFromCatalog,
  installFromFile,
  listCatalog,
  listPluginActions,
  listPluginRecords,
  pluginLogs,
  previewPackage,
  removePlugin,
  savePluginSettings,
  setPluginBell,
  setPluginEnabled,
  setPluginGrants,
} from "../plugins/service.js";

const MAX_UPLOAD = 50 * 1024 * 1024;

async function readUpload(request: FastifyRequest): Promise<{ data: Buffer; fields: Record<string, string> } | null> {
  const part = await request.file({ limits: { fileSize: MAX_UPLOAD } });
  if (!part) return null;
  const data = await part.toBuffer();
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(part.fields)) {
    const field = Array.isArray(v) ? v[0] : v;
    if (field && "value" in field && typeof field.value === "string") fields[k] = field.value;
  }
  return { data, fields };
}

function parseGrants(raw: string | undefined): Partial<PluginGrants> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Partial<PluginGrants>;
  } catch {
    return undefined;
  }
}

function badRequest(errors: string[]) {
  return { error: { code: "validation_error", message: errors.join(" "), errors } };
}

export const pluginsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/plugins", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const last = pluginHostLastContact();
    return {
      plugins: await listPluginRecords(),
      // The plugin container asks for work every few seconds; silence means it is not running.
      host: { connected: last > 0 && Date.now() - last < 30_000, lastContact: last ? new Date(last).toISOString() : null },
      officialCatalog: catalogUrl() === OFFICIAL_CATALOG_URL,
    };
  });

  app.get<{ Querystring: { refresh?: string } }>("/api/v1/plugins/catalog", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    try {
      return { plugins: await listCatalog(request.query.refresh === "1") };
    } catch (err) {
      const detail = err instanceof Error ? err.message : "no connection";
      const message = /\(404\)/.test(detail)
        ? "No official plugins have been published yet."
        : `The official plugin list could not be loaded (${detail}). Check the server's internet connection.`;
      return reply.code(502).send({ error: { code: "catalog_unavailable", message } });
    }
  });

  app.post<{ Body: { id?: string; grants?: Partial<PluginGrants> } }>("/api/v1/plugins/install", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const id = request.body?.id;
    if (typeof id !== "string") return reply.code(400).send(badRequest(["id is required"]));
    const result = await installFromCatalog(id, request.body?.grants);
    if (!result.ok) return reply.code(400).send(badRequest(result.errors));
    return { plugin: result.plugin };
  });

  /** Step 1 of installing from a file: show what the package is and asks for. */
  app.post("/api/v1/plugins/inspect-file", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const upload = await readUpload(request);
    if (!upload) return reply.code(400).send(badRequest(["Choose a plugin file"]));
    const result = await previewPackage(upload.data);
    if (!result.ok) return reply.code(400).send(badRequest(result.errors));
    return { manifest: result.manifest };
  });

  /** Step 2: install it. The page must send acceptUnofficial=yes after showing the warning. */
  app.post("/api/v1/plugins/install-file", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const upload = await readUpload(request);
    if (!upload) return reply.code(400).send(badRequest(["Choose a plugin file"]));
    if (upload.fields.acceptUnofficial !== "yes") {
      return reply.code(400).send(badRequest(["Confirm that you trust this file before installing it."]));
    }
    const result = await installFromFile(upload.data, parseGrants(upload.fields.grants));
    if (!result.ok) return reply.code(400).send(badRequest(result.errors));
    return { plugin: result.plugin };
  });

  app.patch<{ Params: { id: string }; Body: { enabled?: boolean } }>("/api/v1/plugins/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    if (typeof request.body?.enabled !== "boolean") return reply.code(400).send(badRequest(["enabled (true/false) is required"]));
    const plugin = await setPluginEnabled(request.params.id, request.body.enabled);
    if (!plugin) return reply.code(404).send({ error: { code: "not_found", message: "Plugin not found" } });
    return { plugin };
  });

  app.put<{ Params: { id: string }; Body: { grants?: Partial<PluginGrants> } }>(
    "/api/v1/plugins/:id/grants",
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageUsers")) return;
      const plugin = await setPluginGrants(request.params.id, request.body?.grants ?? {});
      if (!plugin) return reply.code(404).send({ error: { code: "not_found", message: "Plugin not found" } });
      return { plugin };
    }
  );

  app.put<{ Params: { id: string }; Body: { bell?: unknown } }>("/api/v1/plugins/:id/bell", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const plugin = await setPluginBell(request.params.id, request.body?.bell);
    if (!plugin) return reply.code(404).send({ error: { code: "not_found", message: "Plugin not found" } });
    return { plugin };
  });

  app.put<{ Params: { id: string }; Body: { settings?: Record<string, unknown> } }>(
    "/api/v1/plugins/:id/settings",
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageUsers")) return;
      const result = await savePluginSettings(request.params.id, request.body?.settings ?? {});
      if (!result.ok) return reply.code(400).send(badRequest(result.errors));
      return { plugin: result.plugin };
    }
  );

  app.get<{ Params: { id: string } }>("/api/v1/plugins/:id/activity", async (request, reply) => {
    if (!requirePermission(request, reply, "viewSystem")) return;
    const plugin = await getPluginRecord(request.params.id);
    if (!plugin) return reply.code(404).send({ error: { code: "not_found", message: "Plugin not found" } });
    return { logs: pluginLogs(plugin.id), actions: await listPluginActions(plugin.id) };
  });

  app.delete<{ Params: { id: string } }>("/api/v1/plugins/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const removed = await removePlugin(request.params.id);
    if (!removed) return reply.code(404).send({ error: { code: "not_found", message: "Plugin not found" } });
    return { ok: true };
  });
};
