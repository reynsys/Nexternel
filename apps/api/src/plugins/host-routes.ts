import { timingSafeEqual } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { getPool } from "../db.js";
import { ensureHostKey } from "./packages.js";
import {
  appendPluginLogs,
  desiredPlugins,
  setRunState,
  startPluginSession,
  type PluginRunState,
} from "./service.js";

/**
 * Routes for the plugin container (apps/plugin-host). It proves itself with the key file
 * both containers share; plugins themselves cannot read that file.
 */
const HOST_HEADER = "x-nexternel-host-key";

function keyMatches(given: unknown, expected: string): boolean {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

let lastHostContact = 0;

/** When the plugin container last asked for work (0 = never since the API started). */
export function pluginHostLastContact(): number {
  return lastHostContact;
}

export const pluginHostRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const expected = await ensureHostKey();
    if (!keyMatches(request.headers[HOST_HEADER], expected)) {
      return reply.code(401).send({ error: { code: "unauthorized", message: "Not the plugin container" } });
    }
    lastHostContact = Date.now();
  });

  app.get("/api/v1/plugin-host/desired", async () => {
    return { plugins: await desiredPlugins() };
  });

  app.post<{ Params: { id: string } }>("/api/v1/plugin-host/start/:id", async (request, reply) => {
    const token = await startPluginSession(request.params.id);
    if (!token) return reply.code(404).send({ error: { code: "not_found", message: "Plugin not installed or switched off" } });
    return { token };
  });

  app.post<{
    Body: { plugins?: { id?: string; state?: string; message?: string; logs?: { t: string; stream: string; line: string }[] }[] };
  }>("/api/v1/plugin-host/report", async (request) => {
    for (const p of request.body?.plugins ?? []) {
      if (typeof p.id !== "string") continue;
      const state = (["running", "starting", "stopped", "crashed"].includes(p.state ?? "") ? p.state : "stopped") as PluginRunState;
      // "starting" clears the old message; once running, the plugin's own message (/plugin-api/status) is kept.
      if (state !== "running") await setRunState(p.id, state, p.message ?? null);
      else await setRunStateRunning(p.id);
      if (Array.isArray(p.logs) && p.logs.length) appendPluginLogs(p.id, p.logs.slice(-200));
    }
    return { ok: true };
  });
};

async function setRunStateRunning(id: string): Promise<void> {
  await getPool().query(
    `UPDATE installed_plugins
     SET status = 'running', status_at = NOW(),
         -- A crash or wait message no longer applies once it runs again.
         status_message = CASE WHEN status IN ('crashed', 'waiting') THEN NULL ELSE status_message END
     WHERE id = $1 AND status <> 'running'`,
    [id]
  );
}
