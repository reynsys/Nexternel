import { getPool } from "../db.js";
import {
  isAdminFromPermissions,
  normalizePermissions,
  permissionsFromIsAdmin,
  type RolePermissions,
} from "./permissions.js";

export type DbRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_admin: boolean;
  is_system: boolean;
  sort_order: number;
  permissions?: unknown;
  created_at: Date;
  updated_at: Date;
};

export type RoleInfo = {
  slug: string;
  name: string;
  isAdmin: boolean;
  permissions: RolePermissions;
};

export function mapRole(r: DbRole) {
  const permissions =
    r.permissions && typeof r.permissions === "object" && Object.keys(r.permissions as object).length > 0
      ? normalizePermissions(r.permissions)
      : permissionsFromIsAdmin(r.is_admin);
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    isAdmin: isAdminFromPermissions(permissions) || r.is_admin,
    isSystem: r.is_system,
    sortOrder: r.sort_order,
    permissions,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const ROLE_SELECT = `SELECT id, slug, name, description, is_admin, is_system, sort_order, permissions, created_at, updated_at
     FROM roles`;

/** Resolve privilege + display name for a users.role slug. */
export async function resolveRoleInfo(
  slug: string | null | undefined
): Promise<RoleInfo> {
  const key = (slug ?? "").trim() || "admin";
  try {
    const result = await getPool().query<DbRole>(
      `${ROLE_SELECT} WHERE slug = $1 LIMIT 1`,
      [key]
    );
    const row = result.rows[0];
    if (row) {
      const mapped = mapRole(row);
      return {
        slug: mapped.slug,
        name: mapped.name,
        isAdmin: mapped.isAdmin,
        permissions: mapped.permissions,
      };
    }
  } catch {
    // roles table / permissions column may be mid-migrate — fall through
  }
  if (key === "admin") {
    return {
      slug: "admin",
      name: "Administrator",
      isAdmin: true,
      permissions: permissionsFromIsAdmin(true),
    };
  }
  return {
    slug: key,
    name: key,
    isAdmin: false,
    permissions: permissionsFromIsAdmin(false),
  };
}

export async function getRoleBySlug(slug: string): Promise<DbRole | null> {
  const result = await getPool().query<DbRole>(
    `${ROLE_SELECT} WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  return result.rows[0] ?? null;
}

export async function getRoleById(id: string): Promise<DbRole | null> {
  const result = await getPool().query<DbRole>(
    `${ROLE_SELECT} WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

const SLUG_RE = /^[a-z][a-z0-9_-]{1,48}$/;

export function normalizeRoleSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return null;
  return slug;
}
