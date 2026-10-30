import type { FastifyPluginAsync } from "fastify";
import { requireUser } from "../auth/plugin.js";
import { requirePermission } from "../auth/rbac.js";
import { clearNotifications, listNotifications, markAllNotificationsRead } from "./service.js";
import { getBellTopics, getOfflineMinutes, setBellTopics, setOfflineMinutes } from "./topics.js";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: string } }>("/api/v1/notifications", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    return listNotifications(request.user!.id, Number(request.query.limit ?? 30) || 30);
  });

  app.post("/api/v1/notifications/read", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    await markAllNotificationsRead(request.user!.id);
    return { ok: true };
  });

  app.delete("/api/v1/notifications", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    await clearNotifications();
    return { ok: true };
  });

  /** Which of Nexternel's own kinds of message reach the bell (Settings → Notifications). */
  app.get("/api/v1/notifications/topics", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    return { topics: await getBellTopics(), offlineMinutes: await getOfflineMinutes() };
  });

  app.put<{ Body: { topics?: Record<string, unknown>; offlineMinutes?: unknown } }>("/api/v1/notifications/topics", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const topics = await setBellTopics(request.body?.topics ?? {});
    const offlineMinutes = request.body?.offlineMinutes !== undefined ? await setOfflineMinutes(request.body.offlineMinutes) : await getOfflineMinutes();
    return { topics, offlineMinutes };
  });
};
