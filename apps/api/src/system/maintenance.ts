import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Maintenance mode: while Nexternel is being updated or a backup is being restored, changes to
 * settings, dashboards, devices, plugins and accounts are refused so nothing is half-saved when
 * services restart. Reading, signing in, and switching devices keep working.
 */
export type Maintenance = {
  active: boolean;
  reason: "update" | "restore" | null;
  /** e.g. the version being installed */
  detail: string | null;
  since: string | null;
};

const restoresRunning = new Map<string, number>();

/** Called by backup jobs as a restore starts and ends. */
export function markRestore(jobId: string, running: boolean): void {
  if (running) restoresRunning.set(jobId, Date.now());
  else restoresRunning.delete(jobId);
}

let cached: { at: number; value: Maintenance } | null = null;

export async function currentMaintenance(): Promise<Maintenance> {
  if (cached && Date.now() - cached.at < 5_000) return cached.value;
  let value: Maintenance = { active: false, reason: null, detail: null, since: null };
  // A restore that has been running for hours has failed without telling us; don't lock forever.
  for (const [id, started] of restoresRunning) if (Date.now() - started > 2 * 3_600_000) restoresRunning.delete(id);
  const restoreStart = Math.min(...restoresRunning.values());
  if (restoresRunning.size) {
    value = { active: true, reason: "restore", detail: null, since: new Date(restoreStart).toISOString() };
  } else {
    const { updateRunInfo } = await import("./updates.js");
    const run = await updateRunInfo().catch(() => null);
    if (run?.state === "updating") value = { active: true, reason: "update", detail: run.target, since: run.since };
  }
  cached = { at: Date.now(), value };
  return value;
}

export function clearMaintenanceCache(): void {
  cached = null;
}

// Changes that stay allowed during maintenance.
const ALLOWED = [
  /^\/api\/v1\/auth\//, // sign in, refresh, sign out
  /^\/api\/v1\/system\/update(\/|$)/, // the update itself and its status
  /^\/api\/v1\/capabilities\/[^/]+\/command$/, // switching devices
  /^\/api\/v1\/plugin-api\//, // plugins keep sending readings
  /^\/api\/v1\/plugin-host\//,
  /^\/api\/v1\/plugin-panels\//, // asking the AI assistant
  /^\/api\/v1\/notifications\/read$/,
];

function message(m: Maintenance): string {
  if (m.reason === "update") {
    return `Nexternel is being updated${m.detail ? ` to ${m.detail}` : ""}. Changes are paused until it finishes, usually a few minutes.`;
  }
  return "A backup is being restored. Changes are paused until it finishes.";
}

/** Fastify hook: refuse changes while maintenance is on. */
export async function maintenanceGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
  const url = request.url.split("?")[0] ?? "";
  if (!url.startsWith("/api/") || ALLOWED.some((re) => re.test(url))) return;
  const m = await currentMaintenance();
  if (!m.active) return;
  await reply.code(503).header("retry-after", "60").send({ error: { code: "maintenance", message: message(m), maintenance: m } });
}
