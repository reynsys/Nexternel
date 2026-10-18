/**
 * "Something changed" messages for every open Nexternel screen (laptop, phone, wall display).
 * Each successful change made through the API is announced on the live socket's "changes" channel
 * with the area it touched; screens showing that area load it again by themselves.
 */
export type ChangeEvent = {
  type: "changed";
  /** The area that changed: "dashboards", "me", "users", "devices", "addons", … */
  topic: string;
  /** Whose account made the change (null for Nexternel itself, e.g. an automatic add-on update). */
  userId: string | null;
  /** The screen that made the change (its X-Nexternel-Client id), so it can skip its own echo. */
  client: string | null;
  at: string;
};

type Listener = (event: ChangeEvent) => void;
const listeners = new Set<Listener>();

export function subscribeChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishChange(topic: string, from: { userId?: string | null; client?: string | null } = {}): void {
  const event: ChangeEvent = { type: "changed", topic, userId: from.userId ?? null, client: from.client ?? null, at: new Date().toISOString() };
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      /* one broken screen must not stop the others */
    }
  }
}

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/** Areas whose requests change nothing other screens show. */
const QUIET = new Set(["health", "diagnostics", "history", "weather", "plugin-panels", "plugin-api", "plugin-host", "ws"]);
/** Requests that only work something out (a POST that reads). */
const READ_ONLY_ENDS = /\/(resolve|resolve-batch|validate|preview|ask|compile|test|check-name)$/;

/** The area a request changed, or null when other screens need not hear about it. */
export function changeTopicFor(method: string, url: string): string | null {
  if (!WRITES.has(method.toUpperCase())) return null;
  const path = url.split("?")[0] ?? "";
  if (READ_ONLY_ENDS.test(path)) return null;
  const m = path.match(/^\/api\/v\d+\/(.+)$/);
  if (!m) return null;
  const segs = m[1].split("/").filter(Boolean);
  if (segs[0] === "v4" || segs[0] === "v5") segs.shift();
  const area = segs[0];
  if (!area || QUIET.has(area)) return null;
  if (area === "auth") return segs[1] === "me" ? "me" : null;
  return area;
}
