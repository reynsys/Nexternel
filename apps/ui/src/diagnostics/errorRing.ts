export type DiagnosticErrorEvent = {
  at: string;
  kind: "error" | "unhandledrejection" | "api";
  message: string;
  source?: string;
  status?: number;
};

const MAX_EVENTS = 30;
const events: DiagnosticErrorEvent[] = [];
let installed = false;

export function pushDiagnosticError(ev: Omit<DiagnosticErrorEvent, "at"> & { at?: string }) {
  events.push({
    at: ev.at ?? new Date().toISOString(),
    kind: ev.kind,
    message: String(ev.message).slice(0, 500),
    source: ev.source?.slice(0, 200),
    status: ev.status,
  });
  while (events.length > MAX_EVENTS) {
    events.shift();
  }
}

export function getDiagnosticErrors(): DiagnosticErrorEvent[] {
  return [...events];
}

export function clearDiagnosticErrors() {
  events.length = 0;
}

export function installErrorRing() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    pushDiagnosticError({
      kind: "error",
      message: e.message || String(e.error ?? "unknown error"),
      source: e.filename
        ? `${e.filename}:${e.lineno ?? "?"}:${e.colno ?? "?"}`
        : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : JSON.stringify(reason);
    pushDiagnosticError({
      kind: "unhandledrejection",
      message: message || "unhandled rejection",
    });
  });
}
