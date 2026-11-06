import { logActivity } from "../activity/activity.js";
import { getCapabilityById } from "../capabilities/store.js";
import { getPool } from "../db.js";
import { getLiveState, setLiveState } from "../telemetry/state-cache.js";
import { UnansweredPresses } from "../telemetry/unanswered-presses.js";
import {
  type ControlFeatures,
  type ControlState,
  type ControlType,
  cleanControlChange,
  cleanControlReport,
  describeControlChange,
  isControlType,
  reportConfirms,
} from "./controls.js";

/** How long a device has to confirm a change. */
const ANSWER_MS = 6_000;
const SWITCH_BACK_RETRY_MS = 5_000;

export class ControlRefusedError extends Error {}
export class ControlNotConfirmedError extends Error {}

/** Each way of reaching a device registers how to send it a change (plugins today). */
type Sender = (capabilityId: string, change: ControlState) => Promise<void>;
let sender: Sender | null = null;
export function setControlSender(fn: Sender): void {
  sender = fn;
}

type Waiter = { wanted: ControlState; done: () => void };
const waiters = new Map<string, Waiter[]>();
const unanswered = new UnansweredPresses();

function waitForReport(capabilityId: string, wanted: ControlState): Promise<boolean> {
  return new Promise((resolve) => {
    const entry: Waiter = { wanted, done: () => {} };
    const drop = () => {
      const left = (waiters.get(capabilityId) ?? []).filter((w) => w !== entry);
      if (left.length) waiters.set(capabilityId, left);
      else waiters.delete(capabilityId);
    };
    const timer = setTimeout(() => {
      drop();
      resolve(false);
    }, ANSWER_MS);
    entry.done = () => {
      clearTimeout(timer);
      drop();
      resolve(true);
    };
    waiters.set(capabilityId, [...(waiters.get(capabilityId) ?? []), entry]);
  });
}

async function controlInfo(capabilityId: string): Promise<{ type: ControlType; features: ControlFeatures } | null> {
  const r = await getPool().query<{ kind: string; features: ControlFeatures }>(
    `SELECT c.kind, dc.features FROM capabilities c
     JOIN device_controls dc ON c.source_type = 'control' AND dc.id = c.source_id
     WHERE c.id = $1`,
    [capabilityId]
  );
  const row = r.rows[0];
  return row && isControlType(row.kind) ? { type: row.kind, features: row.features ?? {} } : null;
}

async function switchBackLateOn(capabilityId: string): Promise<void> {
  const cap = await getCapabilityById(capabilityId);
  if (!sender || !cap) return;
  const send = () => void sender?.(capabilityId, { on: false }).catch(() => undefined);
  send();
  setTimeout(() => {
    if ((getLiveState(capabilityId)?.value as ControlState | undefined)?.on === true) send();
  }, SWITCH_BACK_RETRY_MS);
  void logActivity({
    kind: "device",
    deviceId: cap.device_id,
    text: `${cap.device_name} · ${cap.name} came on after its press had got no answer, so Nexternel switched it off again`,
  });
}

/**
 * A device reported its state. Live state keeps every part it has reported, so a device may report
 * only what changed. Returns false when the report is not understood.
 */
export function recordControlReport(capabilityId: string, raw: unknown): boolean {
  const report = cleanControlReport(raw);
  if (!report) return false;
  const before = (getLiveState(capabilityId)?.value ?? {}) as ControlState;
  const state = { ...before, ...report };
  setLiveState(capabilityId, state, { quality: "good" });
  for (const w of waiters.get(capabilityId) ?? []) {
    if (reportConfirms(state, w.wanted)) w.done();
  }
  if (report.on === true && unanswered.takeLateOn(capabilityId, true, Date.now())) void switchBackLateOn(capabilityId);
  return true;
}

/** Someone changed a control: answers once the device confirms it, as a switch does. */
export async function setControl(capabilityId: string, rawChange: unknown, who: string): Promise<ControlState> {
  const info = await controlInfo(capabilityId);
  const cap = await getCapabilityById(capabilityId);
  if (!info || !cap) throw new ControlRefusedError("This is not a device control");
  const change = cleanControlChange(info.type, info.features, rawChange);
  if (!change) throw new ControlRefusedError("This device cannot do that");
  if (!sender) throw new Error("No way to reach this device");

  unanswered.clear(capabilityId);
  const answer = waitForReport(capabilityId, change);
  await sender(capabilityId, change);
  if (await answer) {
    void logActivity({ kind: "device", deviceId: cap.device_id, text: `${cap.device_name} · ${cap.name} ${describeControlChange(change)}`, who });
    return (getLiveState(capabilityId)?.value ?? change) as ControlState;
  }
  const on = change.on === true;
  if (on) unanswered.note(capabilityId, Date.now());
  void logActivity({
    kind: "device",
    deviceId: cap.device_id,
    text: `${cap.device_name} · ${cap.name}: ${describeControlChange(change)} got no answer${on ? ", so it was cancelled" : ""}`,
    who,
  });
  throw new ControlNotConfirmedError(
    on ? `No answer from ${cap.device_name}, so this press was cancelled.` : `No answer from ${cap.device_name}: it may not have changed.`
  );
}
