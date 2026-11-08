import type { FastifyReply, FastifyRequest } from "fastify";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "../config.js";
import { ENTRANCE_HEADER } from "./login-guard.js";

/**
 * Sign-in record: the last sign-in steps (sign in, renew, "who am I") and every request turned away
 * as not signed in, each with the reason. Kept in memory only (gone after a restart), never any
 * password or token, readable by an administrator (GET /api/v1/diagnostics/sign-ins). It is there to
 * find out why a screen is asked to sign in again.
 */
export type SignInEntry = {
  at: string;
  method: string;
  path: string;
  status: number;
  outside: boolean;
  ip: string;
  browser: string;
  user: string | null;
  /** Which sign-in the request carried: bearer header, cookie, refresh token in the body. */
  carried: string[];
  /** Why a carried sign-in did not count (from the auth check) or the answer's message. */
  reason: string | null;
  /** What the website said about itself when it showed the sign-in form (sign-in requests only). */
  screen: string | null;
};

const MAX_ENTRIES = 300;
const SCREEN_HEADER = "x-nexternel-sign-in-start";
const entries: SignInEntry[] = [];

function worthRecording(path: string, status: number): boolean {
  if (path.startsWith("/api/v1/auth/")) return true;
  return status === 401;
}

function messageOf(payload: unknown): string | null {
  if (typeof payload !== "string" || payload.length > 4000) return null;
  try {
    const body = JSON.parse(payload) as { error?: { code?: string; message?: string } };
    if (!body.error) return null;
    return [body.error.code, body.error.message].filter(Boolean).join(": ") || null;
  } catch {
    return null;
  }
}

export function recordSignInStep(request: FastifyRequest, reply: FastifyReply, payload: unknown): void {
  const path = request.url.split("?")[0] ?? request.url;
  const status = reply.statusCode;
  if (!worthRecording(path, status)) return;
  if (path === "/api/v1/diagnostics/sign-ins") return;

  const carried: string[] = [];
  if (request.headers.authorization) carried.push("bearer");
  if (request.cookies?.[ACCESS_COOKIE]) carried.push("access-cookie");
  if (request.cookies?.[REFRESH_COOKIE]) carried.push("refresh-cookie");
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body === "object" && typeof body.refreshToken === "string" && body.refreshToken) {
    carried.push("refresh-in-body");
  }

  const failures = request.authDebugFailures?.length ? request.authDebugFailures.join(", ") : null;
  const answer = status >= 400 ? messageOf(payload) : null;
  const screen = request.headers[SCREEN_HEADER];
  const loginName = body && typeof body === "object" && typeof body.username === "string" ? body.username : null;

  entries.push({
    at: new Date().toISOString(),
    method: request.method,
    path,
    status,
    outside: request.headers[ENTRANCE_HEADER] !== undefined,
    ip: request.ip,
    browser: String(request.headers["user-agent"] ?? "").slice(0, 160),
    user: request.user?.username ?? loginName?.slice(0, 64) ?? null,
    carried,
    reason: [failures, answer].filter(Boolean).join(" | ") || null,
    screen: typeof screen === "string" ? screen.slice(0, 200) : null,
  });
  while (entries.length > MAX_ENTRIES) entries.shift();
}

/** Newest first. */
export function signInRecord(): SignInEntry[] {
  return [...entries].reverse();
}
