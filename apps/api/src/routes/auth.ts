import type { FastifyPluginAsync } from "fastify";
import { getPool, type DbUser } from "../db.js";
import {
  clearAuthCookies,
  requireUser,
  setAuthCookies,
} from "../auth/plugin.js";
import {
  hashPassword,
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
import { isHomeAddress, loginGuard, waitText } from "../auth/login-guard.js";
import { clearOutsideFails, OUTSIDE_LOCK_AFTER, OUTSIDE_WARN_AT, parseEmail, recordOutsideFail } from "../auth/outside-lock.js";
import { isStrongPassword, passwordProblem } from "../auth/password-rules.js";
import { raiseTokenVersion } from "../auth/token-version.js";
import { tokensFor } from "../auth/issue-tokens.js";
import { addNotification } from "../notifications/service.js";

/** Compared against when the name does not exist, so a wrong name takes as long as a wrong password. */
let dummyHash: Promise<string> | null = null;
function wrongNameHash() {
  dummyHash ??= hashPassword("nexternel-no-such-user");
  return dummyHash;
}

/** Count a wrong password from outside; the bell says so at the warning and when it locks. */
async function warnOutsideFail(userId: string, username: string, ip: string) {
  const { fails, justLocked } = await recordOutsideFail(userId);
  const name = username.slice(0, 60);
  if (justLocked) {
    await addNotification({
      source: "system",
      sourceName: "Nexternel",
      level: "alert",
      title: `"${name}" is locked for signing in from outside`,
      body:
        `Someone outside the home typed ${OUTSIDE_LOCK_AFTER} wrong passwords for this account. ` +
        "Nobody can sign in with it from outside until it is unlocked in Users (or with the email link). " +
        `At home it still works. Last try came from ${ip}.`,
    }).catch(() => undefined);
  } else if (fails === OUTSIDE_WARN_AT) {
    await addNotification({
      source: "system",
      sourceName: "Nexternel",
      level: "warning",
      title: `Someone outside is trying to sign in as "${name}"`,
      body:
        `${fails} wrong passwords from outside the home. After ${OUTSIDE_LOCK_AFTER}, the account is locked for ` +
        `signing in from outside. Last try came from ${ip}. If this was not you, change the password.`,
    }).catch(() => undefined);
  }
}

type AuthUserRow = DbUser & { theme_prefs?: unknown; avatar_data?: string | null; token_version?: number; email?: string | null };

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
    email: user.email ?? null,
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

      const ip = request.ip;
      const fromOutside = !isHomeAddress(ip);
      const allowed = loginGuard.check(ip);
      if (!allowed.ok) {
        reply.header("Retry-After", String(Math.ceil(allowed.retryAfterMs / 1000)));
        return reply.code(429).send({
          error: {
            code: "too_many_attempts",
            message: `Too many wrong passwords. Try again in ${waitText(allowed.retryAfterMs)}.`,
          },
        });
      }

      const result = await getPool().query<AuthUserRow & { outside_locked_at: Date | null }>(
        `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data, token_version, email,
                outside_locked_at
         FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      const user = result.rows[0];

      // Locked from outside: refused whether the password is right or not, so it cannot be tested.
      if (fromOutside && user?.outside_locked_at) {
        request.log.warn({ username, ip }, "login refused: locked from outside");
        return reply.code(423).send({
          error: {
            code: "locked_outside",
            message:
              "This account is locked for signing in from outside, after too many wrong passwords. " +
              "Use the unlock link in the email Nexternel sent, or ask your home's administrator to unlock it in Users.",
          },
        });
      }

      const valid = user && user.is_active
        ? await verifyPassword(password, user.password_hash)
        : (await verifyPassword(password, await wrongNameHash()), false);
      if (!user || !valid) {
        loginGuard.fail(ip);
        request.log.warn({ username, ip }, "login refused: wrong name or password");
        if (fromOutside && user) await warnOutsideFail(user.id, user.username, ip);
        return reply.code(401).send({
          error: { code: "invalid_credentials", message: "Invalid credentials" },
        });
      }
      loginGuard.succeed(ip);

      if (fromOutside) {
        await clearOutsideFails(user.id);
        // Without the second check, signing in from outside needs a strong password.
        if (!isStrongPassword(password, user.username)) {
          return reply.code(403).send({
            error: {
              code: "password_too_weak_outside",
              message:
                "Your password is too simple for signing in from outside the home. " +
                "Sign in at home and choose a new one (at least 12 characters) in My profile.",
            },
          });
        }
      }

      const { roleInfo, accessToken, refreshToken } = await tokensFor(user);

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
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data, token_version, email
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

    if ((user.token_version ?? 0) !== (payload.tokenVersion ?? 0)) {
      clearAuthCookies(reply);
      return reply.code(401).send({
        error: { code: "unauthorized", message: "Signed out" },
      });
    }

    const { accessToken, refreshToken } = await tokensFor(user);
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
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data, token_version, email
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
      email?: string | null;
    };
  }>("/api/v1/auth/me", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const id = request.user!.id;
    const existing = await getPool().query<AuthUserRow>(
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data, token_version, email
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
    let email = user.email ?? null;
    if (request.body?.email !== undefined) {
      const parsed = parseEmail(request.body.email);
      if (parsed === undefined) {
        return reply.code(400).send({ error: { code: "bad_request", message: "That email address does not look right." } });
      }
      email = parsed;
    }

    if (request.body?.displayName !== undefined) {
      const v = request.body.displayName;
      displayName = typeof v === "string" ? v.trim() || null : null;
    }
    if (request.body?.password) {
      const problem = passwordProblem(request.body.password, user.username);
      if (problem) {
        return reply.code(400).send({ error: { code: "weak_password", message: problem } });
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
           avatar_data = $5, email = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data, token_version, email`,
      [id, displayName, passwordHash, JSON.stringify(themePrefs), avatarData, email]
    );
    const saved = result.rows[0];
    if (request.body?.password) {
      // A new password signs this account out everywhere else; this screen gets a fresh login.
      const version = await raiseTokenVersion(id);
      const { accessToken, refreshToken } = await tokensFor(saved, version);
      setAuthCookies(reply, accessToken, refreshToken);
      return { user: await mapAuthUser(saved), accessToken, refreshToken };
    }
    return { user: await mapAuthUser(saved) };
  });

  /** Sign out everywhere else: every other screen signed in to this account has to sign in again. */
  app.post("/api/v1/auth/sign-out-elsewhere", async (request, reply) => {
    if (!requireUser(request, reply)) return;
    const version = await raiseTokenVersion(request.user!.id);
    const res = await getPool().query<AuthUserRow>(
      `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data, token_version, email
       FROM users WHERE id = $1 LIMIT 1`,
      [request.user!.id]
    );
    const user = res.rows[0];
    if (!user || !user.is_active) {
      clearAuthCookies(reply);
      return reply.code(401).send({ error: { code: "unauthorized", message: "User not found" } });
    }
    const { accessToken, refreshToken } = await tokensFor(user, version);
    setAuthCookies(reply, accessToken, refreshToken);
    request.log.info({ username: user.username }, "signed out everywhere else");
    return { ok: true, accessToken, refreshToken, user: await mapAuthUser(user) };
  });
};
