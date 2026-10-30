import { getPool } from "../db.js";
import { publishChange } from "../live/changes.js";
import { compileEsphomeDevice, deviceYamlFile, uploadEsphomeDevice } from "./builder/firmware.js";
import { esphomeGet, filesForAddress } from "./file-identity.js";

/**
 * Updating boards from Nexternel: for each board, prepare its firmware on this server (ESPHome
 * compile), send it over Wi-Fi (ESPHome upload to the board's address), then wait until the board is
 * back online. Runs in the background, one board after another; the Devices page shows each step.
 * Which boards need an update comes from ESPHome itself (its settings changed since the board was
 * last installed, or a newer ESPHome version).
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
};

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
    });
  }
  return out;
}

export type UpdateStep = "waiting" | "preparing" | "sending" | "restarting" | "done" | "failed";
export type UpdateItem = { deviceId: string; name: string; step: UpdateStep; message: string; startedAt: string | null; finishedAt: string | null };
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

async function updateOne(item: UpdateItem): Promise<void> {
  item.startedAt = new Date().toISOString();
  set(item, "preparing", "Preparing the update on this server (the first one can take several minutes)…");
  const built = await compileEsphomeDevice(item.deviceId).catch((err) => ({ ok: false as const, log: err instanceof Error ? err.message : String(err) }));
  if (!built.ok) return set(item, "failed", `Could not prepare the update: ${failureReason(built.log)}`);

  const file = await deviceYamlFile(item.deviceId);
  const board = file ? (await esphomeBoards()).get(file) : undefined;
  const address = board?.ip || board?.ip_addresses?.[0] || null;
  set(item, "sending", "Sending it to the board over Wi-Fi…");
  const sentAt = new Date();
  const sent = await uploadEsphomeDevice(item.deviceId, address).catch((err) => ({ ok: false as const, log: err instanceof Error ? err.message : String(err) }));
  if (!sent.ok) return set(item, "failed", `Could not send the update: ${failureReason(sent.log)}`);

  set(item, "restarting", "The board is restarting with the update…");
  const back = await waitBackOnline(item.deviceId, sentAt);
  set(item, back ? "done" : "failed", back ? "Updated — the board is back online." : "Updated, but the board has not come back online after 4 minutes. Check its power and Wi-Fi.");
}

/** Start updating these boards (one after another). Refused while an update is already running. */
export function startBoardUpdates(boards: { deviceId: string; name: string }[]): UpdateRun {
  if (run.running) throw new Error("Boards are already being updated. Wait until it has finished.");
  run = {
    running: true,
    startedAt: new Date().toISOString(),
    items: boards.map((b) => ({ deviceId: b.deviceId, name: b.name, step: "waiting", message: "Waiting…", startedAt: null, finishedAt: null })),
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
