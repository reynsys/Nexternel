import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import type { PluginManifest } from "@nexternel/plugin-sdk";
import { requireUser } from "../auth/plugin.js";
import { getPool } from "../db.js";
import { pushPluginEvent } from "./events.js";

/**
 * Plugin pages: Nexternel draws the page, and asks the plugin for what to show on it.
 * The browser waits for the plugin's answer, so a call is one question and one reply.
 */
const REPLY_MS = 30_000;
const MAX_PARAMS_BYTES = 8_000;

type PageCall = { pluginId: string; resolve: (reply: { result?: unknown; error?: string }) => void };
const calls = new Map<string, PageCall>();

/** Called by the plugin (through the doorway) with its reply. */
export function replyToPageCall(pluginId: string, id: string, reply: { result?: unknown; error?: unknown }): boolean {
  const call = calls.get(id);
  if (!call || call.pluginId !== pluginId) return false;
  calls.delete(id);
  call.resolve(
    typeof reply.error === "string" && reply.error ? { error: reply.error.slice(0, 500) } : { result: reply.result ?? null }
  );
  return true;
}

export const pluginPageRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { pluginId: string; pageId: string };
    Body: { action?: unknown; params?: unknown };
  }>("/api/v1/plugin-pages/:pluginId/:pageId/call", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const { pluginId, pageId } = request.params;
    const res = await getPool().query<{ manifest: PluginManifest; enabled: boolean; status: string }>(
      `SELECT manifest, enabled, status FROM installed_plugins WHERE id = $1`,
      [pluginId]
    );
    const row = res.rows[0];
    if (!row?.manifest.pages?.some((p) => p.id === pageId)) {
      return reply.code(404).send({ error: { code: "not_found", message: "This page's extension is not installed." } });
    }
    if (!row.enabled || row.status !== "running") {
      const name = row.manifest.name ?? row.manifest.id;
      return reply.code(409).send({ error: { code: "not_running", message: `${name} is not running. Check Extensions → Manage extensions.` } });
    }
    const action = request.body?.action;
    const params = request.body?.params ?? {};
    if (typeof action !== "string" || !action || JSON.stringify(params).length > MAX_PARAMS_BYTES) {
      return reply.code(400).send({ error: { code: "bad_request", message: "That request could not be read." } });
    }
    const id = randomUUID();
    const answer = await new Promise<{ result?: unknown; error?: string }>((resolve) => {
      const timer = setTimeout(() => {
        calls.delete(id);
        resolve({ error: "The extension did not answer in time." });
      }, REPLY_MS);
      calls.set(id, {
        pluginId,
        resolve: (r) => {
          clearTimeout(timer);
          resolve(r);
        },
      });
      const user = request.user!;
      pushPluginEvent(pluginId, {
        type: "page-call",
        id,
        page: pageId,
        action,
        params,
        // The plugin decides who may change things: viewers can look, administrators can change.
        admin: Boolean(user.isAdmin || user.role === "admin"),
      });
    });
    if (answer.error) return reply.code(502).send({ error: { code: "plugin_error", message: answer.error } });
    return { result: answer.result };
  });
};
