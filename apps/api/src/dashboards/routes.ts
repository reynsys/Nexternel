import type { FastifyPluginAsync } from "fastify";
import { emptyDashboardDocument } from "@nexternel/domain";
import { requirePermission } from "../auth/rbac.js";
import {
  createDashboard,
  deleteDashboard,
  getDashboard,
  listDashboards,
  reorderDashboards,
  updateDashboard,
} from "../dashboards/store.js";

function toDto(row: Awaited<ReturnType<typeof getDashboard>>) {
  if (!row) return null;
  const doc = row.document as {
    tabIcon?: string;
    showTabLabel?: boolean;
  };
  return {
    id: row.id,
    name: row.name,
    document: row.document,
    isDefault: row.is_default,
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    tabIcon: typeof doc?.tabIcon === "string" ? doc.tabIcon : "dashboard",
    showTabLabel: doc?.showTabLabel !== false,
  };
}

export const dashboardsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/dashboards", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDashboards")) return;
    const rows = await listDashboards(request.user!.id);
    return { dashboards: rows.map((r) => toDto(r)) };
  });

  app.post<{ Body: { name?: string } }>("/api/v1/dashboards", async (request, reply) => {
    if (!requirePermission(request, reply, "editDashboards")) return;
    const name = request.body?.name?.trim() || "New dashboard";
    const row = await createDashboard({
      name,
      ownerUserId: request.user!.id,
      document: emptyDashboardDocument(name),
    });
    return { dashboard: toDto(row) };
  });

  app.post<{ Body: { orderedIds?: string[] } }>(
    "/api/v1/dashboards/reorder",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDashboards")) return;
      const orderedIds = request.body?.orderedIds;
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "orderedIds must be a non-empty array" },
        });
      }
      const ids = orderedIds.filter((id) => typeof id === "string" && id.trim());
      if (ids.length === 0) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "orderedIds must contain dashboard ids" },
        });
      }
      await reorderDashboards(ids);
      const rows = await listDashboards(request.user!.id);
      return { dashboards: rows.map((r) => toDto(r)) };
    }
  );

  app.get<{ Params: { id: string } }>("/api/v1/dashboards/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "viewDashboards")) return;
    const row = await getDashboard(request.params.id);
    if (!row) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Dashboard not found" },
      });
    }
    return { dashboard: toDto(row) };
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      document?: unknown;
      isDefault?: boolean;
    };
  }>("/api/v1/dashboards/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "editDashboards")) return;
    const row = await updateDashboard(request.params.id, {
      name: request.body?.name,
      document: request.body?.document,
      isDefault: request.body?.isDefault,
    });
    if (!row) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Dashboard not found" },
      });
    }
    return { dashboard: toDto(row) };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/dashboards/:id",
    async (request, reply) => {
      if (!requirePermission(request, reply, "editDashboards")) return;
      const ok = await deleteDashboard(request.params.id);
      if (!ok) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Dashboard not found" },
        });
      }
      return { ok: true };
    }
  );
};
