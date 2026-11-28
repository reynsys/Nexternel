/**
 * Updating one Zherodius device from Nexternel (a step of the shared board updates, devices/board-updates.ts).
 * The device does the real work, exactly as from its own Firmware page: it looks for the newest version for
 * its board, downloads it from the internet, takes it only when it is signed by Zherodius, made for this
 * board and newer, restarts into it, and goes back to the old version by itself if the new one does not
 * start properly. Nexternel asks over the direct line and watches: the download, the restart, the device
 * back with the new version, and the new version kept.
 */
import type { BoardUpdater, BoardStatus } from "../devices/board-updates.js";
import type { ZherodiusConnections } from "./connections.js";
import { updatesFromHub } from "./connections.js";
import { compareVersions, type DeviceUpdate, type Hello } from "./line.js";

export type UpdaterDeps = {
  conn: Pick<ZherodiusConnections, "isOpen" | "hello" | "askUpdate" | "updateOf">;
  /** How often to look while waiting. */
  pollMs?: number;
  /** How long the check, the download, the restart and the trial may each take. */
  checkMs?: number;
  installMs?: number;
  backMs?: number;
  keptMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "Find and fix things." from the device's notes, for after a colon in a sentence. */
function notesWords(notes: string): string {
  return notes.trim().replace(/[.\s]+$/, "");
}

export function createZherodiusUpdater(d: UpdaterDeps): BoardUpdater {
  const pollMs = d.pollMs ?? 2_000;
  const checkMs = d.checkMs ?? 60_000;
  const installMs = d.installMs ?? 5 * 60_000;
  const backMs = d.backMs ?? 4 * 60_000;
  const keptMs = d.keptMs ?? 4 * 60_000;

  /** Ask again and again until `done` says so (null: the time ran out or the line closed). */
  async function waitFor(id: string, ms: number, done: (u: DeviceUpdate) => boolean, each?: (u: DeviceUpdate) => void): Promise<DeviceUpdate | null> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (!d.conn.isOpen(id)) return null;
      try {
        const u = await d.conn.askUpdate(id);
        each?.(u);
        if (done(u)) return u;
      } catch {
        if (!d.conn.isOpen(id)) return null;
      }
      await sleep(pollMs);
    }
    return null;
  }

  /** Wait until the line is open again; gives what the device said when it opened (null: not back in time). */
  async function back(id: string, ms: number): Promise<Hello | null> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const h = d.conn.isOpen(id) ? d.conn.hello(id) : null;
      if (h) return h;
      await sleep(pollMs);
    }
    return null;
  }

  return async (item, { step, log }) => {
    const id = item.deviceId;
    const hello = d.conn.isOpen(id) ? d.conn.hello(id) : null;
    if (!hello) {
      return { step: "failed", message: `${item.name} is not connected to Nexternel.` };
    }
    const from = hello.version;
    if (!updatesFromHub(from)) {
      return { step: "failed", message: `${item.name} runs Zherodius ${from}, which can't be updated from Nexternel yet. Update it once on its own page (Firmware); after that Nexternel can.` };
    }

    // 1. The newest version for this board, asked now (not what the device found earlier today).
    step("preparing", "Asking the device which Zherodius version is the newest for it…");
    log.push(`== Runs Zherodius ${from}: asked to check for the newest version ==`);
    await d.conn.askUpdate(id, "check");
    const checked = await waitFor(id, checkMs, (u) => u.state !== "checking");
    if (!checked) return { step: "failed", message: `${item.name} did not finish looking for an update.` };
    if (checked.state === "failed") {
      log.push(`The check failed: ${checked.message}`);
      return { step: "failed", message: `${item.name} could not look for an update: ${checked.message || "no reason given"}` };
    }
    if (!checked.latest || compareVersions(checked.latest, from) <= 0) {
      log.push("No newer version.");
      return { step: "done", message: `Already up to date (Zherodius ${from}).` };
    }
    const target = checked.latest;
    log.push(`Newest version: ${target}${checked.notes ? ` (${notesWords(checked.notes)})` : ""}`);

    // 2. Download and install, on the device.
    step("sending", `Installing Zherodius ${target}: the device downloads it and checks it is genuine…`);
    await d.conn.askUpdate(id, "install");
    let shown = -1;
    const installed = await waitFor(
      id,
      installMs,
      (u) => u.state === "failed" || u.state === "done",
      (u) => {
        if (u.state === "installing" && u.progress !== shown) {
          shown = u.progress;
          step("sending", `Installing Zherodius ${target}: ${u.progress}% downloaded and checked…`);
        }
      }
    );
    if (installed?.state === "failed") {
      log.push(`The install failed: ${installed.message}`);
      return { step: "failed", message: `Could not install Zherodius ${target}: ${installed.message || "no reason given"}. ${item.name} still runs ${from}.` };
    }
    if (!installed && d.conn.isOpen(id)) {
      return { step: "failed", message: `${item.name} did not finish installing Zherodius ${target} in time. It still runs ${from}; try again.` };
    }
    log.push("== Installed: the device restarts into the new version ==");

    // 3. The restart: the line closes, then opens again with the new version.
    step("restarting", "The device is restarting with the new version…");
    const closeBy = Date.now() + 30_000;
    while (d.conn.isOpen(id) && d.conn.hello(id)?.version === from && Date.now() < closeBy) await sleep(pollMs);
    const after = await back(id, backMs);
    if (!after) {
      log.push("== Not back within the time allowed ==");
      return { step: "failed", message: `Installed, but ${item.name} has not come back after ${Math.round(backMs / 60_000)} minutes. Check its power and Wi-Fi.` };
    }
    if (after.version !== target) {
      log.push(`== Back, but on ${after.version} ==`);
      return {
        step: "failed",
        message: `Zherodius ${target} did not start properly; ${item.name} went back to ${after.version}.`,
      };
    }

    // 4. On trial until it has joined the Wi-Fi properly; then the device keeps it.
    log.push(`== Back on Zherodius ${target}; waiting until the device keeps it ==`);
    const kept = await waitFor(id, keptMs, (u) => !u.trying);
    if (!kept) {
      const now = await back(id, backMs);
      if (now && now.version !== target) {
        return { step: "failed", message: `Zherodius ${target} did not keep running; ${item.name} went back to ${now.version}.` };
      }
      return { step: "done", message: `Updated to Zherodius ${target}.` };
    }
    log.push("== The device keeps the new version ==");
    return { step: "done", message: `Updated to Zherodius ${target}.` };
  };
}

/** One Zherodius device in the board list: which version it runs and whether a newer one is waiting. */
export function zherodiusBoardStatus(o: {
  deviceId: string;
  name: string;
  version: string | null;
  connected: boolean;
  update: { latest: string; notes: string } | null;
  recentDrops: number;
}): BoardStatus {
  const own = Boolean(o.version) && !updatesFromHub(o.version);
  const latest = o.update?.latest && o.version && compareVersions(o.update.latest, o.version) > 0 ? o.update.latest : null;
  const state: BoardStatus["updateState"] = own ? "own-page" : latest ? "update" : "current";
  return {
    deviceId: o.deviceId,
    name: o.name,
    kind: "zherodius",
    file: null,
    known: true,
    linkProblem: null,
    choices: [],
    needsUpdate: state === "update",
    updateReason: latest
      ? `Zherodius ${latest} is ready (it runs ${o.version})${o.update!.notes ? `: ${notesWords(o.update!.notes)}` : ""}`
      : null,
    updateState: state,
    fingerprint: null,
    reachable: o.connected,
    deployedVersion: o.version,
    currentVersion: latest ?? o.version,
    recentDrops: o.recentDrops,
  };
}
