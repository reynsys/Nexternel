/**
 * The one device path. Every way of reaching a device (MQTT, extensions, Zherodius's direct line, the
 * Octopus meter) hands what it hears to this module, and every press or change goes out through it:
 *
 * - a reading, position or control state a device reported (live value, quality, history, Activity log),
 * - a device being heard from, coming online or going offline,
 * - a switch press or control change (temperature, brightness…) that only counts once the device
 *   confirms it, with the "late on" safeguard.
 *
 * A connection only translates: it knows its own addresses and message formats and nothing else.
 * Which connection a device uses is `connectionOf`; how a connection sends to its device is its `ItemSender`.
 */
import type { CapabilityRow } from "../capabilities/store.js";
import { getAllLiveStates, getLiveState, isNoReading, sameLiveValue, setLiveState } from "../telemetry/state-cache.js";
import { UnansweredPresses } from "../telemetry/unanswered-presses.js";
import {
  cleanControlChange,
  cleanControlReport,
  describeControlChange,
  reportConfirms,
  temperatureIsFixed,
  type ControlFeatures,
  type ControlState,
  type ControlType,
} from "./controls.js";
import { LIVE_CAPABILITY_PRESENCE_MS } from "./presence.js";

/** The ways Nexternel reaches a device (stored per device: devices.connection). */
export type Connection = "mqtt" | "extension" | "zherodius" | "octopus";

/**
 * How one connection sends to its device. The device reports its new position or state itself
 * (back through reportItem / reportControl), and only that report counts.
 */
export type ItemSender = {
  /** Why a press for this item cannot go out right now (shown to the person), or null when it can. */
  unavailable(item: CapabilityRow): string | null;
  send(item: CapabilityRow, on: boolean): Promise<void>;
  /** A change to a control (heating, a light…); absent when the connection has no controls. */
  sendControl?(item: CapabilityRow, change: ControlState): Promise<void>;
};

/** What a control is and can do (its device_controls row). */
export type ControlInfo = { type: ControlType; features: ControlFeatures };

/** Everything the device path needs from outside (the database, the Activity log, the clock). */
export type DevicePathDeps = {
  getItem(itemId: string): Promise<CapabilityRow | null>;
  sender(connection: Connection): Promise<ItemSender>;
  getControl(itemId: string): Promise<ControlInfo | null>;
  /** The device of this item was heard from: online, seen now. */
  touchDeviceOfItem(itemId: string): void;
  setDevicesOnline(deviceIds: string[], online: boolean): void;
  /** Items of these devices whose live value turns "stale" when they go offline. */
  itemsToStaleOnOffline(deviceIds: string[]): Promise<string[]>;
  /** Items whose freshness is not judged by age (they report on their own schedule). */
  itemsExemptFromFreshness(): Promise<Set<string>>;
  saveSwitchPosition(itemId: string, on: boolean): void;
  writeHistory(key: HistoryKey, value: number): void;
  logSwitchChange(itemId: string, on: boolean): void;
  logSensorAnswer(itemId: string, answering: boolean): void;
  noteSwitchCommand(itemId: string, on: boolean, who: string): void;
  logActivity(entry: { kind: "device"; deviceId: string; text: string; who?: string }): void;
  now(): number;
};

/** Where a reading is kept in history: the device and the item's own name on it. */
export type HistoryKey = { deviceSlug: string; entityId: string };

/** The device did not confirm a press or change in time. */
export class NotConfirmedError extends Error {}
/** A control change the device cannot do (shown to the person as it is). */
export class ControlRefusedError extends Error {}

/** How long a device has to confirm a press. */
export const SWITCH_ANSWER_MS = 6_000;
/** A device reached through its maker's internet service takes longer to answer. */
export const INTERNET_ANSWER_MS = 15_000;
const SWITCH_BACK_RETRY_MS = 5_000;
/** A device heard from again within this time is not written as online again. */
const HEARD_DEBOUNCE_MS = 15_000;
const FRESHNESS_SWEEP_MS = 15_000;

/** Which connection reaches this item's device. */
export function connectionOf(item: Pick<CapabilityRow, "connection">): Connection {
  return item.connection;
}

/**
 * Whether a person can switch or change this item. Over MQTT that takes the item's command address;
 * other connections reach the device directly, so every switch and control can be changed.
 */
export function canCommand(item: { connection: Connection; source_type: string; command_topic: string | null }): boolean {
  if (item.connection === "mqtt") return Boolean(item.command_topic);
  return item.source_type === "relay" || item.source_type === "control";
}

/** A press or change waiting for the device's report that shows it. */
type Waiter = { matches: (value: unknown) => boolean; done: () => void };

export function createDevicePath(deps: DevicePathDeps) {
  /** Presses and changes waiting for the device to report them. */
  const waiters = new Map<string, Waiter[]>();
  /** A press that got no answer but then came through after all (see unanswered-presses.ts). */
  const unanswered = new UnansweredPresses();
  const lastItemTouch = new Map<string, number>();
  const lastDeviceTouch = new Map<string, number>();
  let freshnessTimer: ReturnType<typeof setInterval> | null = null;

  function dropWaiter(itemId: string, entry: Waiter) {
    const left = (waiters.get(itemId) ?? []).filter((w) => w !== entry);
    if (left.length) waiters.set(itemId, left);
    else waiters.delete(itemId);
  }

  /** The device reported this value: every press or change it shows has happened. */
  function confirm(itemId: string, value: unknown) {
    const waiting = waiters.get(itemId);
    if (!waiting) return;
    const left = waiting.filter((w) => {
      if (!w.matches(value)) return true;
      w.done();
      return false;
    });
    if (left.length) waiters.set(itemId, left);
    else waiters.delete(itemId);
  }

  function waitFor(itemId: string, matches: (value: unknown) => boolean, ms: number): { answer: Promise<boolean>; cancel: () => void } {
    const entry: Waiter = { matches, done: () => {} };
    let cancel = () => {};
    const answer = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        dropWaiter(itemId, entry);
        resolve(false);
      }, ms);
      entry.done = () => {
        clearTimeout(timer);
        resolve(true);
      };
      cancel = () => {
        clearTimeout(timer);
        dropWaiter(itemId, entry);
        resolve(false);
      };
    });
    waiters.set(itemId, [...(waiters.get(itemId) ?? []), entry]);
    return { answer, cancel };
  }

  function touchDeviceOfItem(itemId: string) {
    const now = deps.now();
    if (now - (lastItemTouch.get(itemId) ?? 0) < HEARD_DEBOUNCE_MS) return;
    lastItemTouch.set(itemId, now);
    deps.touchDeviceOfItem(itemId);
  }

  /**
   * A device reported an item's value. `retained` = a kept value replayed on connecting, not news
   * from the device. `history` = where a sensor reading is kept (none: not kept in history).
   */
  function reportItem(itemId: string, value: unknown, opts: { kind: string; retained: boolean; history?: HistoryKey | null }) {
    const { kind, retained } = opts;
    const sensorLike = kind !== "switch";
    const previous = getLiveState(itemId);
    if (!retained || kind === "switch") touchDeviceOfItem(itemId);
    // On connecting, the message service replays each board's last message. When Nexternel already
    // holds that same reading (kept over a restart), the replay tells nothing new: keep the held one with
    // its own time, so a current reading does not turn into "no recent reading" on every update.
    if (retained && sensorLike && previous && sameLiveValue(previous.value, value)) return;
    // A board that cannot read its sensor sends "nan": no value, and the reading says so.
    const noReading = sensorLike && isNoReading(value);
    setLiveState(itemId, noReading ? null : value, {
      quality: noReading ? "error" : retained && sensorLike ? "stale" : "good",
      retained,
    });
    if (sensorLike && !retained && (noReading ? previous?.quality !== "error" : previous?.quality === "error")) {
      deps.logSensorAnswer(itemId, !noReading);
    }
    if (sensorLike && !retained && opts.history) {
      const num = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
      if (Number.isFinite(num)) deps.writeHistory(opts.history, num);
    }
    if (kind === "switch" && typeof value === "boolean") {
      confirm(itemId, value);
      if (!retained && unanswered.takeLateOn(itemId, value, deps.now())) void switchBackLateOn(itemId);
      // A real change from the board (not the kept value replayed on connecting): into the Activity log.
      const before = previous?.value;
      if (!retained && typeof before === "boolean" && before !== value) deps.logSwitchChange(itemId, value);
      deps.saveSwitchPosition(itemId, value);
    }
  }

  /**
   * A device reported the state of a control. It may report only what changed: the live state keeps
   * every part reported so far. Returns false when the report is not understood.
   */
  function reportControl(itemId: string, raw: unknown): boolean {
    const report = cleanControlReport(raw);
    if (!report) return false;
    touchDeviceOfItem(itemId);
    const before = (getLiveState(itemId)?.value ?? {}) as ControlState;
    const state = { ...before, ...report };
    setLiveState(itemId, state, { quality: "good" });
    confirm(itemId, state);
    if (report.on === true && unanswered.takeLateOn(itemId, true, deps.now())) void switchBackLateOn(itemId);
    return true;
  }

  /** A device said it is online (or showed it by switching). */
  function deviceOnline(deviceIds: string[]) {
    if (deviceIds.length) deps.setDevicesOnline(deviceIds, true);
  }

  /** A device is gone: offline, and its live values no longer current. */
  function deviceOffline(deviceIds: string[]) {
    if (!deviceIds.length) return;
    deps.setDevicesOnline(deviceIds, false);
    void deps
      .itemsToStaleOnOffline(deviceIds)
      .then((ids) => {
        for (const id of ids) {
          const s = getLiveState(id);
          if (s && s.quality === "good") setLiveState(id, s.value, { quality: "stale", retained: s.retained });
        }
      })
      .catch(() => {
        /* next report puts it right */
      });
  }

  /** A device sent something (not a kept value): it is there. Written at most every 15 s. */
  function deviceHeard(deviceIds: string[]) {
    const now = deps.now();
    const due = deviceIds.filter((id) => now - (lastDeviceTouch.get(id) ?? 0) >= HEARD_DEBOUNCE_MS);
    for (const id of due) lastDeviceTouch.set(id, now);
    deviceOnline(due);
  }

  /** The device reported "on" after its press was given up on: switch it off again, and say so. */
  async function switchBackLateOn(itemId: string): Promise<void> {
    const item = await deps.getItem(itemId);
    if (!item || !canCommand(item)) return;
    const sender = await deps.sender(connectionOf(item));
    const isControl = item.source_type === "control";
    const send = () => {
      if (isControl) {
        void sender.sendControl?.(item, { on: false }).catch(() => undefined);
        return;
      }
      deps.noteSwitchCommand(itemId, false, "Nexternel");
      void sender.send(item, false).catch(() => undefined);
    };
    const stillOn = () => {
      const value = getLiveState(itemId)?.value;
      return isControl ? (value as ControlState | undefined)?.on === true : value === true;
    };
    send();
    // The device may still be cut off: one more try if it has not gone off.
    setTimeout(() => {
      if (stillOn()) send();
    }, SWITCH_BACK_RETRY_MS);
    deps.logActivity({
      kind: "device",
      deviceId: item.device_id,
      text: `${item.device_name ?? "A board"} · ${item.name} came on after its press had got no answer, so Nexternel switched it off again`,
    });
  }

  /**
   * Someone pressed a switch. Answers once the device reports the new position; `who` goes into the
   * Activity log with the change. Throws NotConfirmedError when the device does not answer in time.
   */
  async function switchItem(itemId: string, action: "on" | "off" | "toggle", who?: string): Promise<{ value: boolean }> {
    const item = await deps.getItem(itemId);
    if (!item) throw new Error("Item not found");
    if (item.kind !== "switch") throw new Error("This item is not a switch");
    if (!canCommand(item)) throw new Error("This item cannot be switched");

    const next = action === "toggle" ? getLiveState(itemId)?.value !== true : action === "on";

    // A new press decides: an earlier unanswered one no longer counts.
    unanswered.clear(itemId);
    // Noted before sending: the board's answer can arrive before the send has finished.
    if (who) deps.noteSwitchCommand(itemId, next, who);

    const sender = await deps.sender(connectionOf(item));
    const why = sender.unavailable(item);
    if (why) throw new Error(why);

    // Already in that position: nothing to wait for (a board need not repeat an unchanged state).
    const alreadyThere = getLiveState(itemId)?.value === next;
    const waiting = alreadyThere ? null : waitFor(itemId, (v) => v === next, SWITCH_ANSWER_MS);
    try {
      await sender.send(item, next);
    } catch (err) {
      waiting?.cancel();
      throw err;
    }

    // Only the board's own report counts: no assumed position.
    if (waiting && !(await waiting.answer)) {
      const board = item.device_name ?? "the board";
      if (next) unanswered.note(itemId, deps.now());
      deps.logActivity({
        kind: "device",
        deviceId: item.device_id,
        text: `${board} · ${item.name}: ${next ? "on" : "off"} press got no answer${next ? ", so it was cancelled" : ""}`,
        who,
      });
      throw new NotConfirmedError(
        next ? `No answer from ${board}, so this press was cancelled.` : `No answer from ${board}: it may not have switched.`
      );
    }
    return { value: next };
  }

  /**
   * Someone changed a control (temperature, mode, brightness…). Answers with the device's new state
   * once its report shows the whole change; the change and `who` go into the Activity log either way.
   */
  async function setControl(itemId: string, rawChange: unknown, who: string): Promise<ControlState> {
    const [info, item] = await Promise.all([deps.getControl(itemId), deps.getItem(itemId)]);
    if (!info || !item) throw new ControlRefusedError("This is not a device control");
    const change = cleanControlChange(info.type, info.features, rawChange);
    if (!change) throw new ControlRefusedError("This device cannot do that");
    const live = (getLiveState(itemId)?.value ?? {}) as ControlState;
    if (change.target !== undefined && change.preset === undefined && temperatureIsFixed(info.features, live)) {
      throw new ControlRefusedError(`Leave ${live.preset} first, then set the temperature`);
    }
    const sender = await deps.sender(connectionOf(item));
    if (!sender.sendControl) throw new Error("Nexternel has no way to change this device");
    const why = sender.unavailable(item);
    if (why) throw new Error(why);

    // A new change decides: an earlier unanswered one no longer counts.
    unanswered.clear(itemId);
    const board = item.device_name ?? "the device";
    const waiting = waitFor(
      itemId,
      (state) => reportConfirms(state as ControlState, change),
      info.features.internet ? INTERNET_ANSWER_MS : SWITCH_ANSWER_MS
    );
    try {
      await sender.sendControl(item, change);
    } catch (err) {
      waiting.cancel();
      throw err;
    }
    if (await waiting.answer) {
      deps.logActivity({ kind: "device", deviceId: item.device_id, text: `${board} · ${item.name} ${describeControlChange(change)}`, who });
      return (getLiveState(itemId)?.value ?? change) as ControlState;
    }
    const on = change.on === true;
    if (on) unanswered.note(itemId, deps.now());
    deps.logActivity({
      kind: "device",
      deviceId: item.device_id,
      text: `${board} · ${item.name}: ${describeControlChange(change)} got no answer${on ? ", so it was cancelled" : ""}`,
      who,
    });
    throw new NotConfirmedError(
      on ? `No answer from ${board}, so this press was cancelled.` : `No answer from ${board}: it may not have changed.`
    );
  }

  /** Live values that have not been renewed for a while turn "stale" (device Offline is derived at read time). */
  async function sweepFreshness(): Promise<void> {
    const exempt = await deps.itemsExemptFromFreshness();
    const now = deps.now();
    for (const state of getAllLiveStates()) {
      if (state.quality !== "good" || exempt.has(state.capabilityId)) continue;
      if (now - Date.parse(state.updatedAt) > LIVE_CAPABILITY_PRESENCE_MS) {
        setLiveState(state.capabilityId, state.value, { quality: "stale", retained: state.retained });
      }
    }
  }

  function startFreshnessSweep() {
    if (freshnessTimer) return;
    freshnessTimer = setInterval(() => void sweepFreshness().catch(() => undefined), FRESHNESS_SWEEP_MS);
    freshnessTimer.unref?.();
  }

  return {
    reportItem,
    reportControl,
    deviceOnline,
    deviceOffline,
    deviceHeard,
    switchItem,
    setControl,
    sweepFreshness,
    startFreshnessSweep,
  };
}

export type DevicePath = ReturnType<typeof createDevicePath>;
