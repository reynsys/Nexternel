import type { FastifyPluginAsync } from "fastify";
import { getPool, type DbUser } from "../db.js";
import {
  clearAuthCookies,
  requireUser,
  setAuthCookies,
} from "../auth/plugin.js";
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyToken,
  verifyTokenDetailed,
} from "../auth/tokens.js";
import { REFRESH_COOKIE } from "../config.js";
import {
  parseThemePrefsInput,
  themePrefsFromDb,
  type ThemePrefsDto,
} from "../auth/theme-prefs.js";
import { parseAvatarInput } from "../auth/avatar.js";
import { resolveRoleInfo } from "../auth/roles.js";

type AuthUserRow = DbUser & { theme_prefs?: unknown; avatar_data?: string | null };

async function mapAuthUser(user: AuthUserRow) {
  const roleInfo = await resolveRoleInfo(user.role);
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: roleInfo.slug,
    roleName: roleInfo.name,
    isAdmin: roleInfo.isAdmin,
    permissions: roleInfo.permissions,
    themePrefs: themePrefsFromDb(user.theme_prefs),
    avatarData: user.avatar_data ?? null,
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: { username?: string; password?: string };
  }>(
    "/api/v1/auth/login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const username = request.body?.username?.trim();
      const password = request.body?.password;
      if (!username || !password) {
        return reply.code(400).send({
          error: { code: "bad_request", message: "Username and password required" },
        });
      }

      const result = await getPool().query<AuthUserRow>(
        `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
         FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      const user = result.rows[0];
      if (!user || !user.is_active) {
        return reply.code(401).send({
          error: { code: "invalid_credentials", message: "Invalid credentials" },
        });
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return reply.code(401).send({
          error: { code: "invalid_credentials", message: "Invalid credentials" },
        });
      }

      const roleInfo = await resolveRoleInfo(user.role);
      const claims = {
        userId: user.id,
        username: user.username,
        role: roleInfo.slug,
        isAdmin: roleInfo.isAdmin,
        permissions: roleInfo.permissions,
      };
      const accessToken = await signAccessToken(claims);
      const refreshToken = await signRefreshToken(claims);

      const roundTrip = await verifyTokenDetailed(accessToken);
      if (!roundTrip.ok || roundTrip.payload.tokenType !== "access") {
        request.log.error(
          { roundTrip },
          "access token failed round-trip verify after login"
        );
        return reply.code(500).send({
          error: {
            code: "token_misconfigured",
            message:
              "Server could not verify the token it just created. Check JWT_SECRET / NEXTAUTH_SECRET.",
            debug: roundTrip,
          },
        });
      }

      clearAuthCookies(reply);
      setAuthCookies(reply, accessToken, refreshToken);
      request.log.info(
        { username: user.username, role: roleInfo.slug, isAdmin: roleInfo.isAdmin },
        "login success"
      );

      return {
        accessToken,
        refreshToken,
        user: await mapAuthUser(user),
      };
    }
  );

  app.post("/api/v1/auth/logout", async (_request, reply) => {
    clearAuthCookies(reply);
    return { ok: true };
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const token =
      request.cookies[REFRESH_COOKIE] ||
      (typeof request.body === "object" &&
      request.body &&
      "refreshToken" in request.body
        ? String((request.body as { refreshToken?: string }).refreshToken ?? "")
        : "");
    if (!token) {
      return reply.code(401).send({
        error: { code: "unauthorized", message: "Refresh token missing" },
      });
    }
    const payload = await verifyToken(token);
    if (!payload || payload.tokenType !== "refresh") {
      clearAuthCookies(reply);
      return reply.code(401).send({
        error: { code: "unauthorized", message: "Invalid refresh token" },
      });
    }

    const result = await getPool().query<AuthUserRow>(
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
       FROM users WHERE id = $1 LIMIT 1`,
      [payload.userId]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      clearAuthCookies(reply);
      return reply.code(401).send({
        error: { code: "unauthorized", message: "User inactive" },
      });
    }

    const roleInfo = await resolveRoleInfo(user.role);
    const claims = {
      userId: user.id,
      username: user.username,
      role: roleInfo.slug,
      isAdmin: roleInfo.isAdmin,
      permissions: roleInfo.permissions,
    };
    const accessToken = await signAccessToken(claims);
    const refreshToken = await signRefreshToken(claims);
    setAuthCookies(reply, accessToken, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: await mapAuthUser(user),
    };
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const result = await getPool().query<AuthUserRow>(
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
       FROM users WHERE id = $1 LIMIT 1`,
      [request.user!.id]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return reply.code(401).send({
        error: { code: "unauthorized", message: "User not found" },
      });
    }
    return { user: await mapAuthUser(user) };
  });

  /** Self-service: any signed-in user may update own name, password, theme, avatar. Role is admin-only elsewhere. */
  app.patch<{
    Body: {
      displayName?: string | null;
      password?: string;
      themePrefs?: ThemePrefsDto;
      avatarData?: string | null;
    };
  }>("/api/v1/auth/me", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const id = request.user!.id;
    const existing = await getPool().query<AuthUserRow>(
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
       FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    const user = existing.rows[0];
    if (!user || !user.is_active) {
      return reply.code(401).send({
        error: { code: "unauthorized", message: "User not found" },
      });
    }

    let displayName = user.display_name;
    let passwordHash = user.password_hash;
    let themePrefs = themePrefsFromDb(user.theme_prefs);
    let avatarData = user.avatar_data ?? null;

    if (request.body?.displayName !== undefined) {
      const v = request.body.displayName;
      displayName = typeof v === "string" ? v.trim() || null : null;
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

    const result = await getPool().query<AuthUserRow>(
      `UPDATE users
       SET display_name = $2, password_hash = $3, theme_prefs = $4::jsonb,
           avatar_data = $5, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data`,
      [id, displayName, passwordHash, JSON.stringify(themePrefs), avatarData]
    );
    return { user: await mapAuthUser(result.rows[0]) };
  });
};
