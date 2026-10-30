import { SignJWT, jwtVerify, errors as JoseErrors } from "jose";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import {
  normalizePermissions,
  permissionsFromIsAdmin,
  type RolePermissions,
} from "./permissions.js";

/** Role slug stored on users / JWT (e.g. admin, viewer, or custom). */
export type AuthRole = string;

export type TokenPayload = {
  userId: string;
  username: string;
  role: AuthRole;
  isAdmin: boolean;
  permissions: RolePermissions;
  tokenType: "access" | "refresh";
};

function secretKey() {
  return new TextEncoder().encode(config.jwtSecret());
}

/** A short-lived pass for one purpose (e.g. "esphome": opening the ESPHome page through Caddy). */
export async function signPassToken(userId: string, scope: string, ttl: string): Promise<string> {
  return new SignJWT({ tokenType: "pass", scope }).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime(ttl).sign(secretKey());
}

/** The user id of a valid pass for `scope`, else null. */
export async function verifyPassToken(token: string, scope: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.tokenType === "pass" && payload.scope === scope && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(
  payload: Omit<TokenPayload, "tokenType">
) {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    isAdmin: payload.isAdmin,
    permissions: payload.permissions,
    tokenType: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(config.accessTtl)
    .sign(secretKey());
}

export async function signRefreshToken(
  payload: Omit<TokenPayload, "tokenType">
) {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    isAdmin: payload.isAdmin,
    permissions: payload.permissions,
    tokenType: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(config.refreshTtl)
    .sign(secretKey());
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: string };

function coerceIsAdmin(role: string, raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  return role === "admin";
}

export async function verifyTokenDetailed(token: string): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      clockTolerance: "60s",
    });

    const userId =
      (typeof payload.sub === "string" && payload.sub) ||
      (typeof payload.userId === "string" ? payload.userId : undefined);
    const username =
      typeof payload.username === "string" ? payload.username : undefined;
    const role = typeof payload.role === "string" ? payload.role : undefined;
    const rawType = payload.tokenType ?? payload.token_type;
    const tokenType =
      rawType === "access" || rawType === "refresh" ? rawType : undefined;

    if (!userId || !username || !role || !tokenType) {
      return {
        ok: false,
        reason: `claims_missing:userId=${Boolean(userId)},username=${Boolean(username)},role=${Boolean(role)},tokenType=${Boolean(tokenType)},keys=${Object.keys(payload).join("|")}`,
      };
    }

    const isAdmin = coerceIsAdmin(role, payload.isAdmin);
    const permissions =
      payload.permissions && typeof payload.permissions === "object"
        ? normalizePermissions(payload.permissions)
        : permissionsFromIsAdmin(isAdmin);

    return {
      ok: true,
      payload: {
        userId,
        username,
        role,
        isAdmin,
        permissions,
        tokenType,
      },
    };
  } catch (err) {
    if (err instanceof JoseErrors.JWTExpired) {
      return { ok: false, reason: "expired" };
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "verify_failed",
    };
  }
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  const result = await verifyTokenDetailed(token);
  return result.ok ? result.payload : null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function roleFromDb(role: string | null | undefined): AuthRole {
  const s = (role ?? "").trim();
  return s || "admin";
}
