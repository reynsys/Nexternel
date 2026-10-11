import { getApiBase, getStoredAccessToken, getWsBase } from "../api";
import { APP_VERSION } from "../version";
import { getDiagnosticErrors, type DiagnosticErrorEvent } from "./errorRing";

export type ClientSnapshot = {
  collectedAt: string;
  uiVersion: string;
  href: string;
  protocol: string;
  hostname: string;
  isSecureContext: boolean;
  randomUuid: "ok" | "missing" | "throws" | string;
  viteApiUrl: string | null;
  apiBase: string;
  wsBase: string;
  accessTokenPresent: boolean;
  userAgent: string;
  viewport: { width: number; height: number };
  recentErrors: DiagnosticErrorEvent[];
};

function probeRandomUuid(): string {
  try {
    if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
      return "missing";
    }
    const id = crypto.randomUUID();
    return typeof id === "string" && id.length > 0 ? "ok" : "throws";
  } catch (err) {
    return err instanceof Error ? `throws: ${err.message}` : "throws";
  }
}

export function buildClientSnapshot(): ClientSnapshot {
  return {
    collectedAt: new Date().toISOString(),
    uiVersion: APP_VERSION,
    href: typeof location !== "undefined" ? location.href : "",
    protocol: typeof location !== "undefined" ? location.protocol : "",
    hostname: typeof location !== "undefined" ? location.hostname : "",
    isSecureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    randomUuid: probeRandomUuid(),
    viteApiUrl: import.meta.env.VITE_API_URL
      ? String(import.meta.env.VITE_API_URL)
      : null,
    apiBase: getApiBase(),
    wsBase: getWsBase(),
    accessTokenPresent: Boolean(getStoredAccessToken()),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : { width: 0, height: 0 },
    recentErrors: getDiagnosticErrors(),
  };
}
