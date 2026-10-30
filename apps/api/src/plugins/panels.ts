import { randomUUID } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import type { PluginManifest, PluginPanelDef } from "@nexternel/plugin-sdk";
import { requireUser } from "../auth/plugin.js";
import { getPool } from "../db.js";
import { pushPluginEvent } from "./events.js";

/**
 * Plugin panels on the dashboard. A "conversation" panel sends a question to its plugin and
 * shows the answer as the plugin writes it; a "text" panel shows what the plugin last wrote.
 */
type PanelRequest = {
  id: string;
  pluginId: string;
  panelId: string;
  userId: string;
  createdAt: number;
  text: string;
  done: boolean;
  error: string | null;
  waiters: Set<() => void>;
};

const REQUEST_TTL_MS = 10 * 60_000;
// Small offline models can take minutes on the first question of the day.
const NO_REPLY_MS = 5 * 60_000;
const requests = new Map<string, PanelRequest>();
const askTimes = new Map<string, number[]>();
const ASKS_PER_10_MIN = 30;

function sweep(): void {
  const now = Date.now();
  for (const [id, r] of requests) {
    if (now - r.createdAt > REQUEST_TTL_MS) requests.delete(id);
    else if (!r.done && !r.text && now - r.createdAt > NO_REPLY_MS) finish(r, "The plugin did not answer in time.");
  }
}
setInterval(sweep, 30_000).unref?.();

function wake(r: PanelRequest): void {
  for (const w of r.waiters) w();
  r.waiters.clear();
}

function finish(r: PanelRequest, error: string | null): void {
  r.done = true;
  r.error = error;
  wake(r);
}

async function findPanel(
  pluginId: string,
  panelId: string
): Promise<{ manifest: PluginManifest; panel: PluginPanelDef; enabled: boolean; status: string } | null> {
  const res = await getPool().query<{ manifest: PluginManifest; enabled: boolean; status: string }>(
    `SELECT manifest, enabled, status FROM installed_plugins WHERE id = $1`,
    [pluginId]
  );
  const row = res.rows[0];
  const panel = row?.manifest.panels?.find((p) => p.id === panelId);
  return row && panel ? { manifest: row.manifest, panel, enabled: row.enabled, status: row.status } : null;
}

/** Called by the plugin (through the doorway) with the answer so far. */
export function replyToPanelRequest(
  pluginId: string,
  requestId: string,
  update: { text?: unknown; done?: unknown; error?: unknown }
): boolean {
  const r = requests.get(requestId);
  if (!r || r.pluginId !== pluginId || r.done) return false;
  if (typeof update.text === "string") r.text = update.text.slice(0, 20_000);
  if (typeof update.error === "string" && update.error) {
    finish(r, update.error.slice(0, 500));
  } else if (update.done === true) {
    finish(r, null);
  } else {
    wake(r);
  }
  return true;
}

export async function setPanelContent(
  pluginId: string,
  panelId: string,
  manifest: PluginManifest,
  content: { title?: unknown; body?: unknown }
): Promise<string | null> {
  const panel = manifest.panels?.find((p) => p.id === panelId);
  if (!panel) return `This plugin has no panel "${panelId}"`;
  if (panel.block !== "text") return `Panel "${panelId}" is not a text panel`;
  await getPool().query(
    `INSERT INTO plugin_panel_content (plugin_id, panel_id, title, body, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (plugin_id, panel_id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, updated_at = NOW()`,
    [
      pluginId,
      panelId,
      typeof content.title === "string" ? content.title.slice(0, 200) : "",
      typeof content.body === "string" ? content.body.slice(0, 20_000) : "",
    ]
  );
  return null;
}

export const pluginPanelRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Params: { pluginId: string; panelId: string };
    Body: { text?: string; history?: { role?: string; text?: string }[] };
  }>("/api/v1/plugin-panels/:pluginId/:panelId/ask", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const found = await findPanel(request.params.pluginId, request.params.panelId);
    if (!found || found.panel.block !== "conversation") {
      return reply.code(404).send({ error: { code: "not_found", message: "This panel's plugin is not installed." } });
    }
    if (!found.enabled || found.status !== "running") {
      const name = found.manifest.name ?? found.manifest.id;
      return reply.code(409).send({ error: { code: "not_running", message: `${name} is not running. Check Settings → Extensions.` } });
    }
    const text = typeof request.body?.text === "string" ? request.body.text.trim().slice(0, 2000) : "";
    if (!text) return reply.code(400).send({ error: { code: "bad_request", message: "Type a question first." } });
    const user = request.user!;
    const now = Date.now();
    const recent = (askTimes.get(user.id) ?? []).filter((t) => now - t < 600_000);
    if (recent.length >= ASKS_PER_10_MIN) {
      return reply.code(429).send({ error: { code: "too_many", message: "Too many questions in a short time; wait a few minutes." } });
    }
    recent.push(now);
    askTimes.set(user.id, recent);
    const history = (request.body?.history ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
      .slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", text: m.text!.slice(0, 2000) }));
    const r: PanelRequest = {
      id: randomUUID(),
      pluginId: request.params.pluginId,
      panelId: request.params.panelId,
      userId: user.id,
      createdAt: now,
      text: "",
      done: false,
      error: null,
      waiters: new Set(),
    };
    requests.set(r.id, r);
    pushPluginEvent(r.pluginId, {
      type: "panel-request",
      id: r.id,
      panel: r.panelId,
      text,
      history,
      user: user.username,
    });
    return { requestId: r.id };
  });

  /** The answer so far; waits up to 20 s for it to grow past `since` characters. */
  app.get<{ Params: { id: string }; Querystring: { since?: string } }>(
    "/api/v1/plugin-panels/requests/:id",
    async (request, reply) => {
      if (!requireUser(request, reply)) return;
      const found = requests.get(request.params.id);
      if (!found || found.userId !== request.user!.id) {
        return reply.code(404).send({ error: { code: "not_found", message: "This question has expired." } });
      }
      const r: PanelRequest = found;
      const since = Number(request.query.since ?? 0) || 0;
      if (!r.done && r.text.length <= since) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, 20_000);
          function done() {
            clearTimeout(timer);
            r.waiters.delete(done);
            resolve();
          }
          r.waiters.add(done);
        });
      }
      return { text: r.text, done: r.done, error: r.error };
    }
  );

  app.get<{ Params: { pluginId: string; panelId: string } }>(
    "/api/v1/plugin-panels/:pluginId/:panelId/content",
    async (request, reply) => {
      if (!requireUser(request, reply)) return;
      const res = await getPool().query<{ title: string; body: string; updated_at: Date }>(
        `SELECT title, body, updated_at FROM plugin_panel_content WHERE plugin_id = $1 AND panel_id = $2`,
        [request.params.pluginId, request.params.panelId]
      );
      const row = res.rows[0];
      return { content: row ? { title: row.title, body: row.body, updatedAt: row.updated_at.toISOString() } : null };
    }
  );
};
