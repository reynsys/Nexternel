import type { FastifyReply, FastifyRequest } from "fastify";
import { getRoleBySlug, normalizeRoleSlug } from "./roles.js";
import type { PermissionKey } from "./permissions.js";
import { VIEWER_PERMISSIONS } from "./permissions.js";

export function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  return requirePermission(request, reply, "manageUsers");
}

export function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  key: PermissionKey
): boolean {
  if (!request.user) {
    reply.code(401).send({
      error: { code: "unauthorized", message: "Authentication required" },
    });
    return false;
  }
  // Full admin (JWT or role slug) always allowed — avoids blank UI if token perms are stale
  if (request.user.isAdmin || request.user.role === "admin") {
    return true;
  }
  const fromToken = request.user.permissions?.[key];
  const allowed =
    typeof fromToken === "boolean"
      ? fromToken
      : VIEWER_PERMISSIONS[key];
  if (!allowed) {
    reply.code(403).send({
      error: {
        code: "forbidden",
        message: `Missing permission: ${key}`,
      },
    });
    return false;
  }
  return true;
}

/** Validate that a role slug exists in the roles table. */
export async function parseRoleSlug(
  value: unknown
): Promise<string | null> {
  const slug = typeof value === "string" ? normalizeRoleSlug(value) : null;
  if (!slug) {
    if (value === "admin" || value === "viewer") return value;
    return null;
  }
  const row = await getRoleBySlug(slug);
  return row ? row.slug : null;
}

/** @deprecated Use parseRoleSlug */
export function parseRole(value: unknown): "admin" | "viewer" | null {
  if (value === "admin" || value === "viewer") return value;
  return null;
}
