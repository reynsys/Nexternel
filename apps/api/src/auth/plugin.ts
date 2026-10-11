import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  config,
} from "../config.js";
import {
  verifyTokenDetailed,
  type AuthRole,
  type TokenPayload,
} from "./tokens.js";
import type { RolePermissions } from "./permissions.js";

export type RequestUser = {
  id: string;
  username: string;
  role: AuthRole;
  isAdmin: boolean;
  permissions: RolePermissions;
};

declare module "fastify" {
  interface FastifyRequest {
    user: RequestUser | null;
    authDebugFailures?: string[];
  }
}

const CUSTOM_TOKEN_HEADER = "x-nexternel-token";

export async function attachUser(request: FastifyRequest) {
  request.user = null;
  request.authDebugFailures = [];

  const headerRaw = request.headers.authorization;
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  let bearer: string | null = null;
  if (typeof header === "string") {
    const m = header.match(/^Bearer\s+(.+)$/i);
    if (m) bearer = m[1].trim();
    else if (header.split(".").length === 3) bearer = header.trim();
  }

  const customRaw = request.headers[CUSTOM_TOKEN_HEADER];
  const customToken = Array.isArray(customRaw)
    ? customRaw[0]?.trim() ?? null
    : typeof customRaw === "string"
      ? customRaw.trim()
      : null;
  const cookie = request.cookies?.[ACCESS_COOKIE]?.trim() || null;

  const candidates: { source: string; token: string }[] = [];
  if (bearer) candidates.push({ source: "bearer", token: bearer });
  if (customToken) candidates.push({ source: "custom", token: customToken });
  if (cookie) candidates.push({ source: "cookie", token: cookie });

  if (candidates.length === 0) {
    if (header || customRaw || request.cookies?.[ACCESS_COOKIE]) {
      request.authDebugFailures.push("parse:headers_present_but_no_token_extracted");
    }
    return;
  }

  for (const { source, token } of candidates) {
    const result = await verifyTokenDetailed(token);
    if (result.ok && result.payload.tokenType === "access") {
      request.user = {
        id: result.payload.userId,
        username: result.payload.username,
        role: result.payload.role,
        isAdmin: result.payload.isAdmin,
        permissions: result.payload.permissions,
      };
      return;
    }
    request.authDebugFailures.push(
      `${source}:${result.ok ? `wrong_type:${result.payload.tokenType}` : result.reason}`
    );
  }
}

export function requireUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    const header = request.headers.authorization;
    const custom = request.headers[CUSTOM_TOKEN_HEADER];
    reply.code(401).send({
      error: {
        code: "unauthorized",
        message: "Authentication required",
        debug: {
          hasAuthorizationHeader: Boolean(header),
          hasCustomTokenHeader: Boolean(custom),
          hasAccessCookie: Boolean(request.cookies?.[ACCESS_COOKIE]),
          bearerLen: header?.startsWith("Bearer ")
            ? header.slice(7).trim().length
            : 0,
          verifyFailures: request.authDebugFailures ?? [],
        },
      },
    });
    return false;
  }
  return true;
}

export function setAuthCookies(
  reply: FastifyReply,
  accessToken: string,
  refreshToken: string
) {
  const common = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax" as const,
    path: "/",
  };
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    ...common,
    maxAge: 60 * 15,
  });
  reply.setCookie(REFRESH_COOKIE, refreshToken, {
    ...common,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(ACCESS_COOKIE, { path: "/" });
  reply.clearCookie(REFRESH_COOKIE, { path: "/" });
}

export const authPlugin: FastifyPluginAsync = async (app) => {
  // Prefer registering attachUser via index.ts route scope (encapsulation-safe).
  app.addHook("onRequest", async (request) => {
    await attachUser(request);
  });
};

export type { TokenPayload };
