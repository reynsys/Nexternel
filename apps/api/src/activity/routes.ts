import type { FastifyPluginAsync } from "fastify";
import { requirePermission } from "../auth/rbac.js";
import { listActivity, type ActivityKind } from "./activity.js";

const KINDS = new Set<ActivityKind>(["device", "switch", "update", "dashboard", "system"]);
const UUID = /^[0-9a-f-]{36}$/i;

export const activityRoutes: FastifyPluginAsync = async (app) => {
  /** The Activity log, newest first: ?kind=device|switch|update|dashboard|system &deviceId= &before= &limit= */
  app.get<{ Querystring: { kind?: string; deviceId?: string; before?: string; limit?: string } }>("/api/v1/activity", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDevices")) return;
    const q = request.query;
    const kind = q.kind && KINDS.has(q.kind as ActivityKind) ? (q.kind as ActivityKind) : undefined;
    const deviceId = q.deviceId && UUID.test(q.deviceId) ? q.deviceId : undefined;
    const before = q.before && !Number.isNaN(Date.parse(q.before)) ? q.before : undefined;
    return { entries: await listActivity({ kind, deviceId, before, limit: Number(q.limit) || undefined }) };
  });
};
