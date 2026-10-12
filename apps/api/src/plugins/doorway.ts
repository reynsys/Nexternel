import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { PluginGrants, PluginManifest } from "@nexternel/plugin-sdk";
import { getPool } from "../db.js";
import { listCapabilities } from "../capabilities/store.js";
import { isHistoryRange, type HistoryRange } from "../history/influx.js";
import { queryCapabilityHistory } from "../history/query.js";
import { addNotification, normalizeLevel } from "../notifications/service.js";
import { getLiveState } from "../telemetry/state-cache.js";
import { APP_VERSION } from "../version.js";
import { definePluginDevices, parseDeviceDefs, recordPluginReadings } from "./devices.js";
import { waitForPluginEvents } from "./events.js";
import { replyToPanelRequest, setPanelContent } from "./panels.js";
import { pluginIdFromToken, tokenMatches } from "./secrets.js";
import { logPluginAction, normalizeGrants, pluginSettingsForRuntime } from "./service.js";

/**
 * The plugin doorway: the only part of Nexternel a plugin can talk to.
 * Every request carries the plugin's own token; every action is checked against what the
 * person approved for that plugin.
 */
type Caller = { id: string; name: string; manifest: PluginManifest; grants: PluginGrants; settings: Record<string, unknown> };

declare module "fastify" {
  interface FastifyRequest {
    plugin?: Caller;
  }
}

function deny(reply: FastifyReply, code: number, message: string) {
  return reply.code(code).send({ error: { code: code === 403 ? "not_allowed" : "unauthorized", message } });
}

async function identify(request: FastifyRequest): Promise<Caller | null> {
  const header = request.headers.authorization;
  const m = typeof header === "string" ? /^Bearer\s+(nxp_\S+)$/.exec(header) : null;
  if (!m) return null;
  const token = m[1]!;
  const id = pluginIdFromToken(token);
  if (!id) return null;
  const res = await getPool().query<{
    id: string; enabled: boolean; manifest: PluginManifest; grants: Partial<PluginGrants>; settings: Record<string, unknown>; token_hash: string | null;
  }>(`SELECT id, enabled, manifest, grants, settings, token_hash FROM installed_plugins WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row || !row.enabled || !tokenMatches(token, row.token_hash)) return null;
  return {
    id: row.id,
    name: row.manifest.name ?? row.id,
    manifest: row.manifest,
    grants: normalizeGrants(row.grants, row.manifest.permissions ?? {}),
    settings: row.settings,
  };
}

/** Areas the plugin may read; null = none, "all" = every area. */
function readableAreas(grants: PluginGrants): null | "all" | Set<string> {
  if (grants.read === null) return null;
  if (grants.read === "all") return "all";
  return new Set(grants.read);
}

// At most this many notifications per plugin per hour, so a faulty plugin cannot flood the bell.
const NOTIFY_PER_HOUR = 30;
const notifyTimes = new Map<string, number[]>();

export const pluginDoorwayRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (request, reply) => {
    const caller = await identify(request);
    if (!caller) return deny(reply, 401, "Unknown or expired plugin token");
    request.plugin = caller;
  });

  app.get("/api/v1/plugin-api/self", async (request) => {
    const p = request.plugin!;
    return {
      id: p.id,
      name: p.name,
      version: p.manifest.version,
      nexternelVersion: APP_VERSION,
      grants: p.grants,
      settings: pluginSettingsForRuntime(p.manifest, p.settings),
    };
  });

  app.put<{ Body: { devices?: unknown } }>("/api/v1/plugin-api/devices", async (request, reply) => {
    const p = request.plugin!;
    if (!p.grants.devices) return deny(reply, 403, "Adding devices was not approved for this plugin");
    const parsed = parseDeviceDefs(request.body?.devices);
    if (!parsed.ok) return reply.code(400).send({ error: { code: "bad_request", message: parsed.error } });
    await definePluginDevices(p.id, parsed.devices);
    return { ok: true, devices: parsed.devices.length };
  });

  app.post<{ Body: { readings?: unknown } }>("/api/v1/plugin-api/readings", async (request, reply) => {
    const p = request.plugin!;
    if (!p.grants.devices) return deny(reply, 403, "Adding devices was not approved for this plugin");
    const list = Array.isArray(request.body?.readings) ? request.body!.readings : null;
    if (!list || list.length > 500) {
      return reply.code(400).send({ error: { code: "bad_request", message: "readings must be a list of at most 500" } });
    }
    const readings = list
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => ({ device: String(r.device ?? ""), item: String(r.item ?? ""), value: r.value }));
    const unknown = await recordPluginReadings(p.id, readings);
    return { ok: true, unknown };
  });

  app.get<{ Querystring: { wait?: string } }>("/api/v1/plugin-api/events", async (request) => {
    const waitMs = Math.min(Math.max(Number(request.query.wait ?? 25) || 25, 0), 25) * 1000;
    return { events: await waitForPluginEvents(request.plugin!.id, waitMs) };
  });

  app.get("/api/v1/plugin-api/capabilities", async (request, reply) => {
    const p = request.plugin!;
    const areas = readableAreas(p.grants);
    if (areas === null) return deny(reply, 403, "Reading was not approved for this plugin");
    const control = new Set(p.grants.control);
    const rows = await listCapabilities();
    return {
      capabilities: rows
        .filter((c) => areas === "all" || areas.has(c.area_id ?? c.room_id ?? ""))
        .map((c) => {
          const s = getLiveState(c.id);
          return {
            id: c.id,
            name: c.name,
            kind: c.kind,
            unit: c.unit,
            device: c.device_name,
            area: c.room_name,
            areaId: c.area_id ?? c.room_id,
            value: s?.value ?? null,
            quality: s?.quality ?? "unknown",
            updatedAt: s?.updatedAt ?? null,
            canControl: control.has(c.id),
          };
        }),
    };
  });

  app.get<{ Querystring: { ids?: string; range?: string } }>("/api/v1/plugin-api/history", async (request, reply) => {
    const p = request.plugin!;
    const areas = readableAreas(p.grants);
    if (areas === null) return deny(reply, 403, "Reading was not approved for this plugin");
    const range = (request.query.range ?? "24h") as HistoryRange;
    if (!isHistoryRange(range)) {
      return reply.code(400).send({ error: { code: "bad_request", message: "range must be one of: 1h, 6h, 24h, 7d" } });
    }
    const ids = (request.query.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 24);
    const readable = new Map((await listCapabilities()).map((c) => [c.id, c]));
    const allowed = ids.filter((id) => {
      const c = readable.get(id);
      return c && (areas === "all" || areas.has(c.area_id ?? c.room_id ?? ""));
    });
    return { range, series: await Promise.all(allowed.map((id) => queryCapabilityHistory(id, range))) };
  });

  app.post<{ Body: { capabilityId?: string; action?: string } }>("/api/v1/plugin-api/control", async (request, reply) => {
    const p = request.plugin!;
    const id = request.body?.capabilityId ?? "";
    const action = request.body?.action;
    if (!p.grants.control.includes(id)) return deny(reply, 403, "Controlling this device was not approved for this plugin");
    if (action !== "on" && action !== "off" && action !== "toggle") {
      return reply.code(400).send({ error: { code: "bad_request", message: "action must be on, off or toggle" } });
    }
    const { publishSwitchCommand } = await import("../telemetry/mqtt.js");
    try {
      const result = await publishSwitchCommand(id, action);
      await logPluginAction(p.id, "control", { capabilityId: id, action, value: result.value });
      return { ok: true, value: result.value };
    } catch (err) {
      return reply.code(400).send({ error: { code: "command_failed", message: err instanceof Error ? err.message : "Command failed" } });
    }
  });

  app.post<{ Body: { title?: string; body?: string; level?: string } }>("/api/v1/plugin-api/notify", async (request, reply) => {
    const p = request.plugin!;
    if (!p.grants.notify) return deny(reply, 403, "Notifications were not approved for this plugin");
    const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
    if (!title) return reply.code(400).send({ error: { code: "bad_request", message: "title is required" } });
    const now = Date.now();
    const recent = (notifyTimes.get(p.id) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= NOTIFY_PER_HOUR) {
      return reply.code(429).send({ error: { code: "too_many", message: `At most ${NOTIFY_PER_HOUR} notifications per hour` } });
    }
    recent.push(now);
    notifyTimes.set(p.id, recent);
    const n = await addNotification({
      source: `plugin:${p.id}`,
      sourceName: p.name,
      level: normalizeLevel(request.body?.level),
      title,
      body: typeof request.body?.body === "string" ? request.body.body : "",
    });
    return { ok: true, id: n.id };
  });

  /** The answer to a question asked on one of this plugin's panels (send the full text so far). */
  app.post<{ Params: { id: string }; Body: { text?: unknown; done?: unknown; error?: unknown } }>(
    "/api/v1/plugin-api/panel-replies/:id",
    async (request, reply) => {
      const ok = replyToPanelRequest(request.plugin!.id, request.params.id, request.body ?? {});
      if (!ok) return reply.code(404).send({ error: { code: "not_found", message: "Unknown, finished or expired question" } });
      return { ok: true };
    }
  );

  app.put<{ Params: { panelId: string }; Body: { title?: unknown; body?: unknown } }>(
    "/api/v1/plugin-api/panels/:panelId/content",
    async (request, reply) => {
      const p = request.plugin!;
      const error = await setPanelContent(p.id, request.params.panelId, p.manifest, request.body ?? {});
      if (error) return reply.code(400).send({ error: { code: "bad_request", message: error } });
      return { ok: true };
    }
  );

  app.post<{ Body: { state?: string; message?: string } }>("/api/v1/plugin-api/status", async (request) => {
    const p = request.plugin!;
    const state = request.body?.state === "error" || request.body?.state === "warning" ? request.body.state : "ok";
    const message = typeof request.body?.message === "string" ? request.body.message.slice(0, 300) : "";
    // Shown under the plugin on the Plugins page; the container reports whether it is running.
    await getPool().query(
      `UPDATE installed_plugins SET status_message = $2, status_at = NOW() WHERE id = $1`,
      [p.id, message ? (state === "ok" ? message : `${state === "error" ? "Problem" : "Warning"}: ${message}`) : null]
    );
    return { ok: true };
  });
};
