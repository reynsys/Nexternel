import type { FastifyPluginAsync } from "fastify";
import { getPool } from "../db.js";
import { requirePermission } from "../auth/rbac.js";
import {
  getRoleById,
  mapRole,
  normalizeRoleSlug,
  type DbRole,
} from "../auth/roles.js";
import {
  isAdminFromPermissions,
  parsePermissionsInput,
  permissionsFromIsAdmin,
  type RolePermissions,
} from "../auth/permissions.js";

const ROLE_RETURNING = `id, slug, name, description, is_admin, is_system, sort_order, permissions, created_at, updated_at`;

export const rolesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/roles", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({
        error: { code: "unauthorized", message: "Authentication required" },
      });
    }
    const can =
      request.user.permissions?.manageRoles ||
      request.user.permissions?.manageUsers ||
      request.user.isAdmin;
    if (!can) {
      return reply.code(403).send({
        error: { code: "forbidden", message: "Missing permission: manageUsers or manageRoles" },
      });
    }
    const result = await getPool().query<DbRole>(
      `SELECT ${ROLE_RETURNING}
       FROM roles
       ORDER BY sort_order ASC, name ASC`
    );
    return { roles: result.rows.map(mapRole) };
  });

  app.post<{
    Body: {
      slug?: string;
      name?: string;
      description?: string | null;
      isAdmin?: boolean;
      permissions?: RolePermissions;
      sortOrder?: number;
    };
  }>("/api/v1/roles", async (request, reply) => {
    if (!requirePermission(request, reply, "manageRoles")) return;
    const slug = normalizeRoleSlug(request.body?.slug);
    const name = request.body?.name?.trim();
    const description =
      typeof request.body?.description === "string"
        ? request.body.description.trim() || null
        : null;
    const sortOrder =
      typeof request.body?.sortOrder === "number" && Number.isFinite(request.body.sortOrder)
        ? Math.trunc(request.body.sortOrder)
        : 100;

    let permissions = permissionsFromIsAdmin(Boolean(request.body?.isAdmin));
    if (request.body?.permissions !== undefined) {
      const parsed = parsePermissionsInput(request.body.permissions);
      if (!parsed) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Invalid permissions object" },
        });
      }
      permissions = parsed;
    }
    const isAdmin = isAdminFromPermissions(permissions);

    if (!slug) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message:
            "slug is required (lowercase letters, numbers, _ or -; start with a letter)",
        },
      });
    }
    if (!name) {
      return reply.code(400).send({
        error: { code: "bad_request", message: "name is required" },
      });
    }
    if (slug === "admin" || slug === "viewer") {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "Cannot recreate system role slugs admin or viewer",
        },
      });
    }

    try {
      const result = await getPool().query<DbRole>(
        `INSERT INTO roles (slug, name, description, is_admin, is_system, sort_order, permissions)
         VALUES ($1, $2, $3, $4, FALSE, $5, $6::jsonb)
         RETURNING ${ROLE_RETURNING}`,
        [slug, name, description, isAdmin, sortOrder, JSON.stringify(permissions)]
      );
      return { role: mapRole(result.rows[0]) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return reply.code(409).send({
          error: { code: "conflict", message: "A role with that slug already exists" },
        });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string | null;
      isAdmin?: boolean;
      permissions?: RolePermissions;
      sortOrder?: number;
    };
  }>("/api/v1/roles/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "manageRoles")) return;
    const existing = await getRoleById(request.params.id);
    if (!existing) {
      return reply.code(404).send({
        error: { code: "not_found", message: "Role not found" },
      });
    }

    const current = mapRole(existing);
    let name = existing.name;
    let description = existing.description;
    let permissions = current.permissions;
    let sortOrder = existing.sort_order;

    if (request.body?.name !== undefined) {
      const n = request.body.name.trim();
      if (!n) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "name cannot be empty" },
        });
      }
      name = n;
    }
    if (request.body?.description !== undefined) {
      const d = request.body.description;
      description = typeof d === "string" ? d.trim() || null : null;
    }
    if (request.body?.permissions !== undefined) {
      const parsed = parsePermissionsInput(request.body.permissions);
      if (!parsed) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Invalid permissions object" },
        });
      }
      permissions = parsed;
    } else if (typeof request.body?.isAdmin === "boolean") {
      // Shortcut: flip all permissions
      if (existing.is_system && existing.slug === "admin" && !request.body.isAdmin) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "Cannot strip all privileges from the system Administrator role",
          },
        });
      }
      permissions = permissionsFromIsAdmin(request.body.isAdmin);
    }
    if (typeof request.body?.sortOrder === "number" && Number.isFinite(request.body.sortOrder)) {
      sortOrder = Math.trunc(request.body.sortOrder);
    }

    // System Administrator must keep manageUsers + manageRoles
    if (existing.is_system && existing.slug === "admin") {
      if (!permissions.manageUsers || !permissions.manageRoles) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message:
              "System Administrator must keep Manage users and Manage roles enabled",
          },
        });
      }
    }

    const isAdmin = isAdminFromPermissions(permissions);

    const result = await getPool().query<DbRole>(
      `UPDATE roles
       SET name = $2, description = $3, is_admin = $4, sort_order = $5,
           permissions = $6::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING ${ROLE_RETURNING}`,
      [
        existing.id,
        name,
        description,
        isAdmin,
        sortOrder,
        JSON.stringify(permissions),
      ]
    );
    return { role: mapRole(result.rows[0]) };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/v1/roles/:id",
    async (request, reply) => {
      if (!requirePermission(request, reply, "manageRoles")) return;
      const existing = await getRoleById(request.params.id);
      if (!existing) {
        return reply.code(404).send({
          error: { code: "not_found", message: "Role not found" },
        });
      }
      if (existing.is_system) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "System roles (Administrator / Viewer) cannot be deleted",
          },
        });
      }

      const users = await getPool().query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE role = $1`,
        [existing.slug]
      );
      const count = Number(users.rows[0]?.count ?? 0);
      if (count > 0) {
        return reply.code(409).send({
          error: {
            code: "conflict",
            message: `Cannot delete role — ${count} user(s) still assigned. Reassign them first.`,
          },
        });
      }

      await getPool().query(`DELETE FROM roles WHERE id = $1`, [existing.id]);
      return { ok: true };
    }
  );
};
