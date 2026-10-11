/**
 * RTSP connection parts — credentials stay separate from the stream address.
 * The composed URL is built only when talking to go2rtc.
 */

export type RtspConnection = {
  host: string;
  port: number;
  path: string;
  username: string;
  password: string;
};

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Build a correctly encoded RTSP URL for go2rtc (never paste this into the UI as source of truth). */
export function composeRtspUrl(c: RtspConnection): string {
  const host = c.host.trim();
  if (!host) throw Object.assign(new Error("Camera host is required"), { code: "validation" });

  const port = Number.isFinite(c.port) && c.port > 0 ? Math.trunc(c.port) : 554;
  const pathRaw = (c.path || "/").trim() || "/";
  const path = pathRaw.startsWith("/") ? pathRaw : `/${pathRaw}`;
  const user = c.username.trim();
  const pass = c.password;

  const authority =
    user || pass
      ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`
      : "";
  const portPart = port === 554 ? "" : `:${port}`;
  return `rtsp://${authority}${host}${portPart}${path}`;
}

/**
 * Parse a full RTSP URL into parts (handles `@` inside passwords via last-@ rule).
 */
export function parseRtspUrl(raw: string): RtspConnection | null {
  const trimmed = raw.trim();
  if (!/^rtsp:\/\//i.test(trimmed)) return null;

  const withoutScheme = trimmed.replace(/^rtsp:\/\//i, "");
  let userinfo = "";
  let hostPortPath = withoutScheme;

  const lastAt = withoutScheme.lastIndexOf("@");
  if (lastAt > 0) {
    const after = withoutScheme.slice(lastAt + 1);
    if (after && /^[A-Za-z0-9.[\]:]/.test(after)) {
      userinfo = withoutScheme.slice(0, lastAt);
      hostPortPath = after;
    }
  }

  let username = "";
  let password = "";
  if (userinfo) {
    const colon = userinfo.indexOf(":");
    if (colon < 0) {
      username = decodeSafe(userinfo);
    } else {
      username = decodeSafe(userinfo.slice(0, colon));
      password = decodeSafe(userinfo.slice(colon + 1));
    }
  }

  const slash = hostPortPath.indexOf("/");
  const hostPort = slash < 0 ? hostPortPath : hostPortPath.slice(0, slash);
  const path = slash < 0 ? "/" : hostPortPath.slice(slash);

  let host = hostPort;
  let port = 554;
  // IPv6 in brackets: [fe80::1]:8554
  const bracket = /^\[([^\]]+)\](?::(\d+))?$/.exec(hostPort);
  if (bracket) {
    host = bracket[1]!;
    if (bracket[2]) port = Number(bracket[2]);
  } else {
    const lastColon = hostPort.lastIndexOf(":");
    if (lastColon > 0 && /^\d+$/.test(hostPort.slice(lastColon + 1))) {
      host = hostPort.slice(0, lastColon);
      port = Number(hostPort.slice(lastColon + 1));
    }
  }

  if (!host.trim()) return null;

  return {
    host: host.trim(),
    port: Number.isFinite(port) && port > 0 ? port : 554,
    path: path || "/",
    username,
    password,
  };
}

/** Preview for admins — password never shown. */
export function rtspConnectionPreview(c: {
  host: string;
  port: number;
  path: string;
  username: string;
  hasPassword: boolean;
}): string {
  const host = c.host.trim() || "…";
  const portPart = c.port && c.port !== 554 ? `:${c.port}` : "";
  const path = c.path?.startsWith("/") ? c.path : `/${c.path || ""}`;
  const user = c.username.trim();
  if (user || c.hasPassword) {
    const pass = c.hasPassword ? "***" : "";
    return `rtsp://${user}${user || c.hasPassword ? ":" : ""}${pass}@${host}${portPart}${path}`;
  }
  return `rtsp://${host}${portPart}${path}`;
}

/** Legacy helper used by brand presets. */
export function buildRtspUrl(opts: {
  user: string;
  password: string;
  host: string;
  port?: number;
  pathTemplate: string;
}): string {
  return composeRtspUrl({
    host: opts.host,
    port: opts.port ?? 554,
    path: opts.pathTemplate,
    username: opts.user,
    password: opts.password,
  });
}

/** Re-compose from a pasted full URL (encode credentials). */
export function normalizeRtspUrl(raw: string): string {
  const parsed = parseRtspUrl(raw);
  if (!parsed) return raw.trim();
  return composeRtspUrl(parsed);
}
