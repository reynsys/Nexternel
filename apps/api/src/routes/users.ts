import type { FastifyPluginAsync } from "fastify";
import { getPool, type DbUser } from "../db.js";
import { requirePermission, parseRoleSlug } from "../auth/rbac.js";
import { hashPassword } from "../auth/tokens.js";
import {
  defaultThemePrefs,
  parseThemePrefsInput,
  themePrefsFromDb,
  type ThemePrefsDto,
} from "../auth/theme-prefs.js";
import { parseAvatarInput } from "../auth/avatar.js";
import { resolveRoleInfo } from "../auth/roles.js";

type UserRow = {
  id: string;
  username: string;
  display_name: string | null;
  is_active: boolean;
  role: string;
  created_at: Date;
  theme_prefs?: unknown;
  avatar_data?: string | null;
};

async function mapUser(u: UserRow) {
  const roleInfo = await resolveRoleInfo(u.role);
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    isActive: u.is_active,
    role: roleInfo.slug,
    roleName: roleInfo.name,
    isAdmin: roleInfo.isAdmin,
    createdAt: u.created_at.toISOString(),
    themePrefs: themePrefsFromDb(u.theme_prefs),
    avatarData: u.avatar_data ?? null,
  };
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/v1/users", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const result = await getPool().query<UserRow>(
      `SELECT id, username, display_name, is_active, role, created_at, theme_prefs, avatar_data
       FROM users
       ORDER BY username ASC`
    );
    const users = await Promise.all(result.rows.map(mapUser));
    return { users };
  });

  app.post<{
    Body: {
      username?: string;
      password?: string;
      displayName?: string;
      role?: string;
      themePrefs?: ThemePrefsDto;
      avatarData?: string | null;
    };
  }>("/api/v1/users", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const username = request.body?.username?.trim();
    const password = request.body?.password;
    const displayName = request.body?.displayName?.trim() || null;
    const role = await parseRoleSlug(request.body?.role ?? "viewer");
    let themePrefs = defaultThemePrefs();
    if (request.body?.themePrefs !== undefined) {
      const parsed = parseThemePrefsInput(request.body.themePrefs);
      if (!parsed) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "themePrefs must include mode, primary (#RRGGBB), and skinId",
          },
        });
      }
      themePrefs = parsed;
    }
    let avatarData: string | null = null;
    if (request.body?.avatarData !== undefined) {
      const parsed = parseAvatarInput(request.body.avatarData);
      if (parsed === null && request.body.avatarData !== null && request.body.avatarData !== "") {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message:
              "avatarData must be a JPEG/PNG/WebP data URL under ~250KB (or null to clear)",
          },
        });
      }
      avatarData = parsed ?? null;
    }
    if (!username || !password) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "username and password are required",
        },
      });
    }
    if (!role) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "role must be an existing role slug",
        },
      });
    }
    if (password.length < 6) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "password must be at least 6 characters",
        },
      });
    }

    const hash = await hashPassword(password);
    try {
      const result = await getPool().query<UserRow>(
        `INSERT INTO users (username, password_hash, display_name, role, is_active, theme_prefs, avatar_data)
         VALUES ($1, $2, $3, $4, TRUE, $5::jsonb, $6)
         RETURNING id, username, display_name, is_active, role, created_at, theme_prefs, avatar_data`,
        [username, hash, displayName, role, JSON.stringify(themePrefs), avatarData]
      );
      return { user: await mapUser(result.rows[0]) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return reply.code(409).send({
          error: { code: "conflict", message: "Username already exists" },
        });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: {
      displayName?: string | null;
      role?: string;
      isActive?: boolean;
      password?: string;
      themePrefs?: ThemePrefsDto;
      avatarData?: string | null;
    };
  }>("/api/v1/users/:id", async (request, reply) => {
    if (!requirePermission(request, reply, "manageUsers")) return;
    const id = request.params.id;
    const existing = await getPool().query<DbUser>(
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
       FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!existing.rows[0]) {
      return reply.code(404).send({
        error: { code: "not_found", message: "User not found" },
      });
    }

    let displayName = existing.rows[0].display_name;
    let role = existing.rows[0].role;
    let isActive = existing.rows[0].is_active;
    let passwordHash = existing.rows[0].password_hash;
    let themePrefs = themePrefsFromDb(existing.rows[0].theme_prefs);
    let avatarData = existing.rows[0].avatar_data ?? null;

    if (request.body?.displayName !== undefined) {
      const v = request.body.displayName;
      displayName = typeof v === "string" ? v.trim() || null : null;
    }
    if (request.body?.role !== undefined) {
      const parsed = await parseRoleSlug(request.body.role);
      if (!parsed) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "role must be an existing role slug",
          },
        });
      }
      role = parsed;
    }
    if (typeof request.body?.isActive === "boolean") {
      isActive = request.body.isActive;
    }
    if (request.body?.password) {
      if (request.body.password.length < 6) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "password must be at least 6 characters",
          },
        });
      }
      passwordHash = await hashPassword(request.body.password);
    }
    if (request.body?.themePrefs !== undefined) {
      const parsed = parseThemePrefsInput(request.body.themePrefs);
      if (!parsed) {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message: "themePrefs must include mode, primary (#RRGGBB), and skinId",
          },
        });
      }
      themePrefs = parsed;
    }
    if (request.body?.avatarData !== undefined) {
      const parsed = parseAvatarInput(request.body.avatarData);
      if (parsed === null && request.body.avatarData !== null && request.body.avatarData !== "") {
        return reply.code(400).send({
          error: {
            code: "bad_request",
            message:
              "avatarData must be a JPEG/PNG/WebP data URL under ~250KB (or null to clear)",
          },
        });
      }
      avatarData = parsed ?? null;
    }

    const nextRoleInfo = await resolveRoleInfo(role);
    // Prevent locking yourself out of admin privileges
    if (
      request.user!.id === id &&
      (!nextRoleInfo.isAdmin || isActive === false)
    ) {
      return reply.code(400).send({
        error: {
          code: "bad_request",
          message: "Cannot remove Administrator access or deactivate your own account",
        },
      });
    }

    const result = await getPool().query<UserRow>(
      `UPDATE users
       SET display_name = $2, role = $3, is_active = $4, password_hash = $5,
           theme_prefs = $6::jsonb, avatar_data = $7, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, display_name, is_active, role, created_at, theme_prefs, avatar_data`,
      [
        id,
        displayName,
        role,
        isActive,
        passwordHash,
        JSON.stringify(themePrefs),
        avatarData,
      ]
    );
    return { user: await mapUser(result.rows[0]) };
  });
};
