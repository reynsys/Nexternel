import { getPool } from "../db.js";
import { publishChange } from "../live/changes.js";
import { compileEsphomeDevice, deviceYamlFile, uploadEsphomeDevice } from "./builder/firmware.js";
import { esphomeGet, filesForAddress } from "./file-identity.js";
import { buildCacheMismatch } from "./cli-log.js";

/**
 * Updating boards from Nexternel: for each board, prepare its firmware on this server (ESPHome
 * compile), send it over Wi-Fi (ESPHome upload to the board's address), then wait until the board is
 * back online. Runs in the background, one board after another; the Devices page shows each step.
 * Which boards need an update comes from ESPHome itself (its settings changed since the board was
 * last installed, or a newer ESPHome version). Building and sending go through ESPHome's own job list
 * (esphome-jobs.ts), so ESPHome's record is right straight after; everything ESPHome writes is kept
 * per board (board_update_log) for the update's details.
 */

/** How long a board may take to come back after its update. */
const BACK_ONLINE_MS = 4 * 60_000;

/** What ESPHome knows about one board (its own list, through its private socket). */
type EsphomeBoard = {
  configuration: string;
  ip?: string;
  ip_addresses?: string[];
  state?: string;
  has_pending_changes?: boolean;
  update_available?: boolean;
  deployed_version?: string;
  current_version?: string;
  /** What the last build is (ESPHome's fingerprint of it) and what the board says it runs. */
  expected_config_hash?: string;
  deployed_config_hash?: string;
};

async function esphomeBoards(): Promise<Map<string, EsphomeBoard>> {
  const r = await esphomeGet<{ configured?: EsphomeBoard[] }>("/devices");
  return new Map((r?.configured ?? []).map((b) => [b.configuration, b]));
}

export type BoardStatus = {
  deviceId: string;
  name: string;
  /** The board's settings file (linked by its exact message address), when there is one. */
  file: string | null;
  /** ESPHome has this board's settings file. */
  known: boolean;
  /** Not linked: no file has this board's address ("none"), or several do ("several": `choices`). */
  linkProblem: "none" | "several" | null;
  choices: string[];
  /** The board runs older software or settings than its file (it needs an update). */
  needsUpdate: boolean;
  /** The board can be reached over Wi-Fi now. */
  reachable: boolean;
  deployedVersion: string | null;
  currentVersion: string | null;
  /** How often the board dropped off Wi-Fi in the last 15 minutes (unsteady from UNSTEADY_DROPS). */
  recentDrops: number;
};

/** Drop-outs in 15 minutes from which updating over Wi-Fi is likely to fail. */
export const UNSTEADY_DROPS = 3;

async function recentDrops(deviceId: string): Promise<number> {
  const r = await getPool().query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM device_connection_events WHERE device_id = $1 AND state = 'offline' AND at >= NOW() - INTERVAL '15 minutes'`,
    [deviceId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

/** Every ESPHome board in Nexternel with what ESPHome says about it. */
export async function listBoardStatus(): Promise<BoardStatus[]> {
  const [devices, boards] = await Promise.all([
    getPool().query<{ id: string; name: string; mqtt_topic_prefix: string | null }>(
      `SELECT id, name, mqtt_topic_prefix FROM devices WHERE COALESCE(firmware_type, 'esphome') = 'esphome' AND is_enabled ORDER BY name`
    ),
    esphomeBoards(),
  ]);
  const out: BoardStatus[] = [];
  for (const d of devices.rows) {
    const file = await deviceYamlFile(d.id);
    const b = file ? boards.get(file) : undefined;
    const choices = !file && d.mqtt_topic_prefix ? await filesForAddress(d.mqtt_topic_prefix) : [];
    out.push({
      deviceId: d.id,
      name: d.name,
      file,
      linkProblem: file ? null : choices.length > 1 ? "several" : "none",
      choices,
      known: Boolean(b),
      needsUpdate: Boolean(b && (b.has_pending_changes || b.update_available)),
      reachable: Boolean(b && (b.state === "online" || b.ip)),
      deployedVersion: b?.deployed_version ?? null,
      currentVersion: b?.current_version ?? null,
      recentDrops: await recentDrops(d.id),
    });
  }
  return out;
}

export type UpdateStep = "waiting" | "preparing" | "sending" | "restarting" | "done" | "failed";
export type UpdateItem = {
  deviceId: string;
  name: string;
  step: UpdateStep;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** The kept record of this update (GET /api/v1/esphome/updates/log/:id), once it has finished. */
  logId: string | null;
};
export type UpdateRun = { running: boolean; startedAt: string | null; items: UpdateItem[] };

let run: UpdateRun = { running: false, startedAt: null, items: [] };

export function updateRun(): UpdateRun {
  return run;
}

function set(item: UpdateItem, step: UpdateStep, message: string) {
  item.step = step;
  item.message = message;
  if (step === "done" || step === "failed") item.finishedAt = new Date().toISOString();
  publishChange("devices");
}

/** The useful line of a failed ESPHome run, in plain words where we know them. */
export function failureReason(log: string): string {
  if (/timed out|Connection refused|No route to host|Error resolving|Failed to connect|could not connect/i.test(log)) {
    return "The board could not be reached over Wi-Fi. Check that it is powered and online, then try again.";
  }
  if (/secrets?\.yaml|!secret/i.test(log)) return "A Wi-Fi or message password is missing in the ESPHome settings (secrets).";
  if (buildCacheMismatch(log)) return "The board's earlier build files could not be reused or cleared. Try Update board again; if it repeats, tell support.";
  const line = log
    .split("\n")
    .reverse()
    .find((l) => /ERROR|Error:/.test(l));
  return line ? line.replace(/^.*?(ERROR|Error:)\s*/, "").slice(0, 240) : "ESPHome could not finish the update.";
}

async function waitBackOnline(deviceId: string, since: Date): Promise<boolean> {
  const end = Date.now() + BACK_ONLINE_MS;
  while (Date.now() < end) {
    const r = await getPool().query(
      `SELECT 1 FROM devices WHERE id = $1 AND mqtt_availability = 'online' AND last_seen_at >= $2`,
      [deviceId, since]
    );
    if (r.rowCount) return true;
    await new Promise((res) => setTimeout(res, 5_000));
  }
  return false;
}

/** After a build, ESPHome updates its record of the board on its own; wait (briefly) until it has. */
async function boardAfterBuild(file: string, before: string | undefined): Promise<EsphomeBoard | undefined> {
  const end = Date.now() + 20_000;
  let board = (await esphomeBoards()).get(file);
  while (Date.now() < end && board?.expected_config_hash === before) {
    await new Promise((res) => setTimeout(res, 2_000));
    board = (await esphomeBoards()).get(file);
  }
  return board;
}

/** The board already runs exactly this build (ESPHome's fingerprints of both match). */
function alreadyRunsIt(board: EsphomeBoard | undefined): boolean {
  return Boolean(board?.expected_config_hash && board.expected_config_hash === board.deployed_config_hash && !board.update_available);
}

async function keepLog(item: UpdateItem, log: string[]): Promise<void> {
  const r = await getPool().query<{ id: string }>(
    `INSERT INTO board_update_log (device_id, started_at, outcome, message, log) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [item.deviceId, item.startedAt, item.step, item.message, log.join("\n\n")]
  );
  item.logId = r.rows[0]?.id ?? null;
  await getPool().query(
    `DELETE FROM board_update_log WHERE device_id = $1 AND id NOT IN (SELECT id FROM board_update_log WHERE device_id = $1 ORDER BY finished_at DESC LIMIT 10)`,
    [item.deviceId]
  );
  publishChange("devices");
}

/** "It dropped off Wi-Fi 9 times in the 15 minutes before." — or nothing when it was steady. */
function dropsNote(drops: number): string {
  return drops >= UNSTEADY_DROPS
    ? ` It dropped off Wi-Fi ${drops} times in the 15 minutes before, so its Wi-Fi is unsteady: install the update with a USB cable instead (Devices → the board → Install with a USB cable).`
    : "";
}

async function updateOne(item: UpdateItem): Promise<void> {
  item.startedAt = new Date().toISOString();
  const log: string[] = [];
  const finish = async (step: UpdateStep, message: string) => {
    set(item, step, message);
    log.unshift(`${step === "failed" ? "FAILED" : "RESULT"}: ${message}`);
    await keepLog(item, log).catch(() => undefined);
  };
  const drops = await recentDrops(item.deviceId);
  if (drops >= UNSTEADY_DROPS) log.push(`Before the update: the board dropped off Wi-Fi ${drops} times in the last 15 minutes.`);

  const file = await deviceYamlFile(item.deviceId);
  const before = file ? (await esphomeBoards()).get(file) : undefined;
  set(item, "preparing", "Preparing the update on this server (the first one can take several minutes)…");
  const built = await compileEsphomeDevice(item.deviceId).catch((err) => ({ ok: false as const, log: err instanceof Error ? err.message : String(err) }));
  log.push(`== Preparing the update (ESPHome build) ==\n${built.log}`);
  if (!built.ok) return finish("failed", `Could not prepare the update: ${failureReason(built.log)}`);

  const board = file ? await boardAfterBuild(file, before?.expected_config_hash) : undefined;
  if (alreadyRunsIt(board)) return finish("done", "Already up to date — the board runs exactly this software.");
  const address = board?.ip || board?.ip_addresses?.[0] || null;
  set(item, "sending", "Sending it to the board over Wi-Fi…");
  const sentAt = new Date();
  const sent = await uploadEsphomeDevice(item.deviceId, address).catch((err) => ({ ok: false as const, log: err instanceof Error ? err.message : String(err) }));
  log.push(`== Sending it to the board (to ${address || "its name on the network"}) ==\n${sent.log}`);
  if (!sent.ok) return finish("failed", `Could not send the update: ${failureReason(sent.log)}${dropsNote(Math.max(drops, await recentDrops(item.deviceId)))}`);

  set(item, "restarting", "The board is restarting with the update…");
  const back = await waitBackOnline(item.deviceId, sentAt);
  log.push(back ? "== The board came back online ==" : "== The board did not come back online within 4 minutes ==");
  await finish(back ? "done" : "failed", back ? "Updated — the board is back online." : "Updated, but the board has not come back online after 4 minutes. Check its power and Wi-Fi.");
}

/** One kept update record (what ESPHome wrote, the outcome). */
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
export function startBoardUpdates(boards: { deviceId: string; name: string }[]): UpdateRun {
  if (run.running) throw new Error("Boards are already being updated. Wait until it has finished.");
  run = {
    running: true,
    startedAt: new Date().toISOString(),
    items: boards.map((b) => ({ deviceId: b.deviceId, name: b.name, step: "waiting", message: "Waiting…", startedAt: null, finishedAt: null, logId: null })),
  };
  publishChange("devices");
  void (async () => {
    for (const item of run.items) {
      try {
        await updateOne(item);
      } catch (err) {
        set(item, "failed", err instanceof Error ? err.message : "The update failed.");
      }
    }
    run.running = false;
    publishChange("devices");
  })();
  return run;
}
