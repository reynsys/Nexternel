import { getPool } from "../db.js";
import { publishChange } from "../live/changes.js";

/**
 * Updating boards from Nexternel, for every kind of board (ESPHome and Zherodius): one list of the boards
 * that need an update, one run that updates the chosen ones one after another in the background (the
 * Devices page shows each board's step), and one kept record per update (board_update_log).
 * Each kind of board says which of its boards need an update and how one board is updated
 * (esphome/board-updates.ts, zherodius/board-updates.ts); everything else is here, once.
 * Boards are never updated without someone asking.
 */

export type BoardKind = "esphome" | "zherodius";

export type BoardStatus = {
  deviceId: string;
  name: string;
  kind: BoardKind;
  /** ESPHome: the board's settings file (linked by its exact message address), when there is one. */
  file: string | null;
  /** ESPHome has this board's settings file (Zherodius: always). */
  known: boolean;
  /** ESPHome, not linked: no file has this board's address ("none"), or several do ("several": `choices`). */
  linkProblem: "none" | "several" | null;
  choices: string[];
  /** The board runs older software than the newest one for it (it needs an update). */
  needsUpdate: boolean;
  /** Why it needs one, in plain words. A board is never "update" without a reason. */
  updateReason: string | null;
  /**
   * "current": runs the newest software; "update": needs an update; "unknown": Nexternel cannot tell
   * which software the board runs (one update tells it); "own-page": a Zherodius board too old to be
   * updated from Nexternel (it is updated once on its own page, then Nexternel can).
   */
  updateState: "current" | "update" | "unknown" | "own-page";
  /** ESPHome: the software fingerprint the board reports (what it runs), or null. */
  fingerprint: string | null;
  /** The board can be reached over Wi-Fi now. */
  reachable: boolean;
  /** The version the board runs, and the newest one for it (null: not known). */
  deployedVersion: string | null;
  currentVersion: string | null;
  /** How often the board dropped off Wi-Fi in the last 15 minutes (unsteady from UNSTEADY_DROPS). */
  recentDrops: number;
};

/** Drop-outs in 15 minutes from which updating over Wi-Fi is likely to fail. */
export const UNSTEADY_DROPS = 3;

export async function recentDrops(deviceId: string): Promise<number> {
  const r = await getPool().query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM device_connection_events WHERE device_id = $1 AND state = 'offline' AND at >= NOW() - INTERVAL '15 minutes'`,
    [deviceId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

export type UpdateStep = "waiting" | "preparing" | "sending" | "restarting" | "done" | "failed";
export type UpdateItem = {
  deviceId: string;
  name: string;
  kind: BoardKind;
  step: UpdateStep;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** The kept record of this update (GET /api/v1/boards/updates/log/:id), once it has finished. */
  logId: string | null;
};
export type UpdateRun = {
  running: boolean;
  startedAt: string | null;
  /** Who started it (the person signed in); boards are never updated without someone asking. */
  startedBy: string | null;
  items: UpdateItem[];
};

/**
 * How one board of a kind is updated. `step` shows where it is; `log` collects what happened (kept with
 * the update); the result is the last step ("done" or "failed") with its message.
 */
export type BoardUpdater = (
  item: UpdateItem,
  ctx: { step(step: UpdateStep, message: string): void; log: string[] }
) => Promise<{ step: "done" | "failed"; message: string }>;

const updaters = new Map<BoardKind, BoardUpdater>();
const listers = new Map<BoardKind, () => Promise<BoardStatus[]>>();

/** A kind of board takes part: how its boards are listed and how one is updated. */
export function registerBoardKind(kind: BoardKind, o: { list: () => Promise<BoardStatus[]>; update: BoardUpdater }): void {
  listers.set(kind, o.list);
  updaters.set(kind, o.update);
}

/** Every board of every kind, by name. A kind that cannot be asked right now leaves out only its own boards. */
export async function listBoardStatus(): Promise<BoardStatus[]> {
  const lists = await Promise.all([...listers.values()].map((l) => l().catch(() => [] as BoardStatus[])));
  return lists.flat().sort((a, b) => a.name.localeCompare(b.name));
}

let run: UpdateRun = { running: false, startedAt: null, startedBy: null, items: [] };

export function updateRun(): UpdateRun {
  return run;
}

function set(item: UpdateItem, step: UpdateStep, message: string) {
  item.step = step;
  item.message = message;
  if (step === "done" || step === "failed") item.finishedAt = new Date().toISOString();
  publishChange("devices");
}

async function keepLog(item: UpdateItem, log: string[]): Promise<void> {
  const r = await getPool().query<{ id: string }>(
    `INSERT INTO board_update_log (device_id, started_at, outcome, message, log, started_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [item.deviceId, item.startedAt, item.step, item.message, log.join("\n\n"), run.startedBy]
  );
  item.logId = r.rows[0]?.id ?? null;
  await getPool().query(
    `DELETE FROM board_update_log WHERE device_id = $1 AND id NOT IN (SELECT id FROM board_update_log WHERE device_id = $1 ORDER BY finished_at DESC LIMIT 10)`,
    [item.deviceId]
  );
  publishChange("devices");
}

async function updateOne(item: UpdateItem): Promise<void> {
  item.startedAt = new Date().toISOString();
  const log: string[] = [];
  const updater = updaters.get(item.kind);
  let result: { step: "done" | "failed"; message: string };
  try {
    result = updater
      ? await updater(item, { step: (s, m) => set(item, s, m), log })
      : { step: "failed", message: "Nexternel can't update this kind of board." };
  } catch (err) {
    result = { step: "failed", message: err instanceof Error ? err.message : "The update failed." };
  }
  set(item, result.step, result.message);
  log.unshift(`${result.step === "failed" ? "FAILED" : "RESULT"}: ${result.message}`);
  await keepLog(item, log).catch(() => undefined);
}

/** One kept update record (what happened, the outcome). */
export async function updateLog(id: string): Promise<{ id: string; deviceId: string; startedAt: string; finishedAt: string; outcome: string; message: string; log: string } | null> {
  if (!/^\d+$/.test(id)) return null;
  const r = await getPool().query(
    `SELECT id, device_id AS "deviceId", started_at AS "startedAt", finished_at AS "finishedAt", outcome, message, log FROM board_update_log WHERE id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

/** A board's kept updates, newest first (without the long record). */
export async function boardUpdateHistory(deviceId: string): Promise<{ id: string; startedAt: string; finishedAt: string; outcome: string; message: string }[]> {
  const r = await getPool().query(
    `SELECT id, started_at AS "startedAt", finished_at AS "finishedAt", outcome, message FROM board_update_log WHERE device_id = $1 ORDER BY finished_at DESC`,
    [deviceId]
  );
  return r.rows;
}

/** Start updating these boards (one after another). Refused while an update is already running. */
export function startBoardUpdates(boards: { deviceId: string; name: string; kind: BoardKind }[], startedBy: string): UpdateRun {
  if (run.running) throw new Error("Boards are already being updated. Wait until it has finished.");
  run = {
    running: true,
    startedAt: new Date().toISOString(),
    startedBy,
    items: boards.map((b) => ({ deviceId: b.deviceId, name: b.name, kind: b.kind, step: "waiting", message: "Waiting…", startedAt: null, finishedAt: null, logId: null })),
  };
  publishChange("devices");
  void (async () => {
    for (const item of run.items) await updateOne(item);
    run.running = false;
    publishChange("devices");
  })();
  return run;
}
