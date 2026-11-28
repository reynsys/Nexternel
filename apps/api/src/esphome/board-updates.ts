import { getPool } from "../db.js";
import { recentDrops, registerBoardKind, UNSTEADY_DROPS, type BoardStatus, type BoardUpdater } from "../devices/board-updates.js";
import { compileEsphomeDevice, deviceYamlFile, uploadEsphomeDevice } from "./builder/firmware.js";
import { esphomeGet, filesForAddress } from "./file-identity.js";
import { buildCacheMismatch } from "./cli-log.js";
import { boardFingerprint } from "../devices/board-health.js";
import fs from "fs";
import path from "path";
import { esphomeDir } from "../migrate/paths.js";
import { sharedSettingsChangedAt, sharedSettingsNews } from "./shared-settings.js";

/**
 * Updating ESPHome boards from Nexternel (the run itself, the list and the kept records are shared by
 * every kind of board: devices/board-updates.ts): for each board, prepare its firmware on this server (ESPHome
 * compile), send it over Wi-Fi (ESPHome upload to the board's address), then wait until the board is
 * back online. Runs in the background, one board after another; the Devices page shows each step.
 * Which boards need an update: the software fingerprint the board itself reports over MQTT
 * (devices/board-health.ts) compared with ESPHome's fingerprint of the newest build of its settings,
 * or a newer ESPHome than the board runs. ESPHome's own "pending" flag is not used: it relies on
 * network announcements that do not reach the server on every home network, and then keeps old
 * fingerprints. A board that does not report its fingerprint yet is "not known" (one update from
 * Nexternel gives it the reading). Building and sending go through ESPHome's own job list
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

/** Every ESPHome board in Nexternel with what ESPHome says about it. */
async function listEsphomeBoards(): Promise<BoardStatus[]> {
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
    let updateState = boardUpdateState(b, boardFingerprint(d.mqtt_topic_prefix));
    const updateReason = updateState === "update" && file ? await updateReasonFor(d.id, file, b) : null;
    // Only a newer ESPHome on the server, nothing in the board's settings: no update (it would change nothing).
    if (updateState === "update" && !updateReason) updateState = "current";
    out.push({
      deviceId: d.id,
      name: d.name,
      kind: "esphome",
      file,
      linkProblem: file ? null : choices.length > 1 ? "several" : "none",
      choices,
      known: Boolean(b),
      needsUpdate: updateState === "update",
      updateReason,
      updateState,
      fingerprint: boardFingerprint(d.mqtt_topic_prefix),
      reachable: Boolean(b && (b.state === "online" || b.ip)),
      deployedVersion: b?.deployed_version ?? null,
      currentVersion: b?.current_version ?? null,
      recentDrops: await recentDrops(d.id),
    });
  }
  return out;
}

const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Why a board whose software differs from the newest build needs an update: what changed since its
 * last update from Nexternel. Null when only ESPHome on the server is newer (then nothing is needed).
 */
async function updateReasonFor(deviceId: string, file: string, board: EsphomeBoard | undefined): Promise<string | null> {
  const r = await getPool().query<{ at: Date | null }>(
    `SELECT MAX(finished_at) AS at FROM board_update_log WHERE device_id = $1 AND outcome = 'done'`,
    [deviceId]
  );
  const last = r.rows[0]?.at ?? null;
  const reasons: string[] = [];
  try {
    const changed = fs.statSync(path.join(esphomeDir(), file)).mtime;
    if (!last || changed > last) reasons.push(`its settings file was changed (${when(changed)})`);
  } catch {
    /* no file: nothing to say */
  }
  const shared = await sharedSettingsChangedAt();
  if (shared && (!last || shared > last)) {
    // "V5.2.168: emergency Wi-Fi hotspot" → "(emergency Wi-Fi hotspot, new in V5.2.168)"
    const news = /^(V[\d.]+):\s*(.+)$/.exec(sharedSettingsNews() ?? "");
    reasons.push(`the shared board settings changed${news ? ` (${news[2]}, new in ${news[1]})` : ""}`);
  }
  if (reasons.length) return reasons.join("; ").replace(/^./, (c) => c.toUpperCase());
  const newerEsphome = board?.deployed_version && board.current_version && board.deployed_version !== board.current_version;
  if (newerEsphome) return null;
  return "It runs different firmware from its settings file";
}

/**
 * Does the board's software differ from the newest build of its file? The fingerprint it reports is
 * compared with ESPHome's fingerprint of that build. A newer ESPHome alone is not a reason.
 */
export function boardUpdateState(board: EsphomeBoard | undefined, running: string | null): BoardStatus["updateState"] {
  if (!board) return "unknown";
  const newest = board.expected_config_hash?.toLowerCase() || null;
  if (!running || !newest) return "unknown";
  return running === newest ? "current" : "update";
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
      `SELECT 1 FROM devices WHERE id = $1 AND availability = 'online' AND last_seen_at >= $2`,
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

/** The board already runs exactly this build (the fingerprint it reports is the build's). */
function alreadyRunsIt(board: EsphomeBoard | undefined, prefix: string | null): boolean {
  return boardUpdateState(board, boardFingerprint(prefix)) === "current";
}

async function devicePrefix(deviceId: string): Promise<string | null> {
  const r = await getPool().query<{ p: string | null }>(`SELECT mqtt_topic_prefix AS p FROM devices WHERE id = $1`, [deviceId]);
  return r.rows[0]?.p ?? null;
}

/** After the restart: wait (briefly) until the board reports the new build's fingerprint. */
async function confirmsNewSoftware(prefix: string | null, expected: string | undefined): Promise<boolean> {
  if (!prefix || !expected) return false;
  const end = Date.now() + 60_000;
  while (Date.now() < end) {
    if (boardFingerprint(prefix) === expected.toLowerCase()) return true;
    await new Promise((res) => setTimeout(res, 3_000));
  }
  return false;
}

/** "It dropped off Wi-Fi 9 times in the 15 minutes before." — or nothing when it was steady. */
function dropsNote(drops: number): string {
  return drops >= UNSTEADY_DROPS
    ? ` It dropped off Wi-Fi ${drops} times in the 15 minutes before, so its Wi-Fi is unsteady: install the update with a USB cable instead (Devices → the board → Install with USB).`
    : "";
}

const esphomeUpdate: BoardUpdater = async (item, { step, log }) => {
  const drops = await recentDrops(item.deviceId);
  if (drops >= UNSTEADY_DROPS) log.push(`Before the update: the board dropped off Wi-Fi ${drops} times in the last 15 minutes.`);

  const file = await deviceYamlFile(item.deviceId);
  const before = file ? (await esphomeBoards()).get(file) : undefined;
  step("preparing", "Preparing the update on this server (the first one can take several minutes)…");
  const built = await compileEsphomeDevice(item.deviceId).catch((err) => ({ ok: false as const, log: err instanceof Error ? err.message : String(err) }));
  log.push(`== Preparing the update (ESPHome build) ==\n${built.log}`);
  if (!built.ok) return { step: "failed", message: `Could not prepare the update: ${failureReason(built.log)}` };

  const board = file ? await boardAfterBuild(file, before?.expected_config_hash) : undefined;
  const prefix = await devicePrefix(item.deviceId);
  if (alreadyRunsIt(board, prefix)) return { step: "done", message: "Already up to date." };
  const address = board?.ip || board?.ip_addresses?.[0] || null;
  step("sending", "Sending it to the board over Wi-Fi…");
  const sentAt = new Date();
  const sent = await uploadEsphomeDevice(item.deviceId, address).catch((err) => ({ ok: false as const, log: err instanceof Error ? err.message : String(err) }));
  log.push(`== Sending it to the board (to ${address || "its name on the network"}) ==\n${sent.log}`);
  if (!sent.ok) return { step: "failed", message: `Could not send the update: ${failureReason(sent.log)}${dropsNote(Math.max(drops, await recentDrops(item.deviceId)))}` };

  step("restarting", "The board is restarting with the update…");
  const back = await waitBackOnline(item.deviceId, sentAt);
  log.push(back ? "== The board came back online ==" : "== The board did not come back online within 4 minutes ==");
  if (!back) return { step: "failed", message: "Updated, but the board has not come back online after 4 minutes. Check its power and Wi-Fi." };
  // The board says which software it runs: proof the new one is in (boards updated before this
  // reading existed start reporting it with this update).
  const confirmed = await confirmsNewSoftware(prefix, board?.expected_config_hash);
  log.push(confirmed ? `== The board reports the new firmware (${board?.expected_config_hash}) ==` : "== The board did not report its firmware fingerprint (yet) ==");
  return { step: "done", message: "Updated." };
};

registerBoardKind("esphome", { list: listEsphomeBoards, update: esphomeUpdate });
