import { getPool } from "../db.js";
import {
  ALL_PERMISSIONS_ON,
  VIEWER_PERMISSIONS,
  normalizePermissions,
} from "./permissions.js";

export async function ensureRolesSchema(): Promise<void> {
  const pool = getPool();

  await pool.query(`
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(50) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);

  await pool.query(`
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb
`);

  await pool.query(
    `INSERT INTO roles (slug, name, description, is_admin, is_system, sort_order, permissions)
     VALUES ($1, $2, $3, TRUE, TRUE, 0, $4::jsonb)
     ON CONFLICT (slug) DO NOTHING`,
    [
      "admin",
      "Administrator",
      "Full access — manage users, roles, devices, and settings",
      JSON.stringify(ALL_PERMISSIONS_ON),
    ]
  );

  await pool.query(
    `INSERT INTO roles (slug, name, description, is_admin, is_system, sort_order, permissions)
     VALUES ($1, $2, $3, FALSE, TRUE, 10, $4::jsonb)
     ON CONFLICT (slug) DO NOTHING`,
    [
      "viewer",
      "Viewer",
      "View dashboards and Live; change only own profile / appearance",
      JSON.stringify(VIEWER_PERMISSIONS),
    ]
  );

  // Backfill empty / broken permission objects
  const rows = await pool.query<{
    id: string;
    slug: string;
    is_admin: boolean;
    permissions: unknown;
  }>(`SELECT id, slug, is_admin, permissions FROM roles`);

  for (const row of rows.rows) {
    const raw = row.permissions;
    const empty =
      raw == null ||
      (typeof raw === "object" &&
        !Array.isArray(raw) &&
        Object.keys(raw as object).length === 0);
    let next = empty
      ? row.is_admin || row.slug === "admin"
        ? ALL_PERMISSIONS_ON
        : VIEWER_PERMISSIONS
      : normalizePermissions(raw);

    // Restored/custom roles with every view flag off → treat as broken, not intentional
    const canView =
      next.viewDashboards || next.viewSystem || next.viewDevices || row.slug === "admin";
    if (!canView) {
      next = row.is_admin ? { ...ALL_PERMISSIONS_ON } : { ...VIEWER_PERMISSIONS };
    }

    // Always keep system Administrator fully privileged
    if (row.slug === "admin") {
      next = { ...ALL_PERMISSIONS_ON };
    }

    // Ensure every known key exists (migrate forward)
    next = normalizePermissions({ ...VIEWER_PERMISSIONS, ...next });
    if (row.slug === "admin") {
      next = { ...ALL_PERMISSIONS_ON };
    }

    await pool.query(
      `UPDATE roles SET permissions = $2::jsonb, is_admin = $3, updated_at = NOW() WHERE id = $1`,
      [
        row.id,
        JSON.stringify(next),
        row.slug === "admin" ? true : row.is_admin,
      ]
    );
  }

  await pool.query(`
UPDATE users SET role = 'admin'
WHERE role IS NULL OR role = '' OR role NOT IN (SELECT slug FROM roles)
`);
}
