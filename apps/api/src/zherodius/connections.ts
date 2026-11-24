/**
 * The Zherodius connection: Nexternel keeps one direct line open to every paired Zherodius device and
 * hands everything to the shared device path (devices/device-path.ts):
 * - the line open = online; the line closed (or silent too long) = offline, then it is opened again;
 * - every status the device sends (at once after each change, and at least every 30 s) = its readings;
 * - a changed `cfg` (names or parts changed on the device) = its items are read again (Zh.GetInfo);
 * - a press = Relay.Set over the line; the device's answer confirms it;
 * - Nexternel's name on the device follows the home's name: told when the line opens and when it changes;
 * - removing the device in Nexternel asks it to forget Nexternel too (Zh.Unpair), so it frees that place;
 * - a newer Zherodius found by the device's own update check is noted (its status says which), so Devices can
 *   offer it; installing it is asked over the line (Zh.Update), only when the owner presses Update.
 * A device that moved to another address is found again by its serial number on the home network.
 * A device that no longer accepts Nexternel (removed on its own page, or reset) is marked for "Reconnect"
 * (pairing-state.ts) and tried only every 30 minutes, as only pairing again helps.
 */
import type { CapabilityRow } from "../capabilities/store.js";
import type { DevicePath, ItemSender } from "../devices/device-path.js";
import { readStatus, type ItemMap } from "./items.js";
import type { X25519Key } from "./line-crypto.js";
import { setNeedsPairing } from "./pairing-state.js";
import {
  compareVersions,
  LineError,
  NoAnswerError,
  NotPairedError,
  openLine,
  UPDATES_FROM_HUB,
  type DeviceInfo,
  type DeviceStatus,
  type DeviceUpdate,
  type Hello,
  type Line,
} from "./line.js";

export type Pairing = {
  deviceId: string;
  deviceName: string;
  deviceSlug: string;
  serial: string;
  address: string;
  deviceKey: string;
  /** The device's cfg mark when its items were last read (null: not read yet). */
  cfg: number | null;
  /** The name the device knows Nexternel by (null: not known). */
  hubName: string | null;
};

export type ConnectionsDeps = {
  hubKey(): Promise<X25519Key>;
  listPairings(): Promise<Pairing[]>;
  itemsOf(deviceId: string): Promise<ItemMap>;
  /** Make the device's items match what it says it is made of; gives the items as they are now. */
  syncItems(deviceId: string, info: DeviceInfo): Promise<ItemMap>;
  saveSeen(deviceId: string, seen: { address: string; cfg: number | null; version: string }): void;
  /** How Nexternel names itself to devices now. */
  hubName(): Promise<string>;
  saveHubName(deviceId: string, name: string): void;
  /** The device's address on the home network now, found by its serial number (null: not seen). */
  findAddress(serial: string): Promise<string | null>;
  path: Pick<DevicePath, "reportItem" | "deviceOnline" | "deviceOffline" | "deviceHeard">;
  logActivity(entry: { deviceId: string; text: string }): void;
  /** The device found a newer Zherodius (told once per device and version, also after a restart). */
  updateReady?(entry: { deviceId: string; deviceName: string; version: string; latest: string; notes: string }): void;
  /** Waits between tries to open a line (the last one repeats). */
  retryMs?: number[];
  /** Wait between tries while the device does not accept this Nexternel (only pairing again helps). */
  notPairedRetryMs?: number;
  /** A line the device has said nothing on for this long is taken as gone. */
  silentMs?: number;
  /** The devices' line port (LINE_PORT; tests use the pretend device's). */
  linePort?: number;
};

/** The device sends its status at least every 30 seconds: two missed ones and a bit = gone. */
const SILENT_MS = 75_000;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];
/** A device that does not accept this Nexternel is asked again only every 30 minutes (its pairings may come back from a backup). */
const NOT_PAIRED_RETRY_MS = 30 * 60_000;
/** Longer than the shared path waits for a press, so the shared path decides about "no answer". */
const PRESS_ANSWER_MS = 7_000;
/** How long the device has to confirm it forgot Nexternel. */
const UNPAIR_ANSWER_MS = 5_000;

type Entry = {
  p: Pairing;
  line: Line | null;
  connecting: boolean;
  stopped: boolean;
  attempt: number;
  retry: ReturnType<typeof setTimeout> | null;
  lastHeard: number;
  items: ItemMap;
  /** Why the line is not open, as last told in the Activity log (told again only when it changes). */
  problem: string | null;
  /** Statuses and item reads, one after the other. */
  chain: Promise<void>;
  /** The device's Wi-Fi signal and time since its start, from its last status. */
  health: { rssi: number | null; uptimeS: number | null; at: number } | null;
  /** The newer version the device found and its notes (null: none, or the device can't say). */
  update: { latest: string; notes: string } | null;
};

/** Whether a device on this version can be asked about updates over the line. */
export function updatesFromHub(version: string | null | undefined): boolean {
  return Boolean(version) && compareVersions(version!, UPDATES_FROM_HUB) >= 0;
}

export function createZherodiusConnections(deps: ConnectionsDeps) {
  const entries = new Map<string, Entry>();
  const retryMs = deps.retryMs ?? RETRY_MS;
  const notPairedRetryMs = deps.notPairedRetryMs ?? NOT_PAIRED_RETRY_MS;
  const silentMs = deps.silentMs ?? SILENT_MS;
  let watchdog: ReturnType<typeof setInterval> | null = null;

  function entryOfItem(itemId: string): { entry: Entry; slug: string } | null {
    for (const entry of entries.values()) {
      for (const [slug, item] of entry.items) if (item.itemId === itemId) return { entry, slug };
    }
    return null;
  }

  function tell(entry: Entry, problem: string | null) {
    if (problem === entry.problem) return;
    entry.problem = problem;
    if (problem) deps.logActivity({ deviceId: entry.p.deviceId, text: `${entry.p.deviceName}: ${problem}` });
  }

  /** Runs after what is already queued; the queue goes on even when this step fails. */
  function queue(entry: Entry, step: () => Promise<void>): Promise<void> {
    const run = entry.chain.then(step);
    entry.chain = run.catch(() => {
      /* the line ends on its own when the device stops answering */
    });
    return run;
  }

  function scheduleRetry(entry: Entry, wait = retryMs[Math.min(entry.attempt, retryMs.length - 1)]!) {
    if (entry.stopped || entry.retry) return;
    entry.attempt += 1;
    entry.retry = setTimeout(() => {
      entry.retry = null;
      void connect(entry);
    }, wait);
    entry.retry.unref?.();
  }

  async function readItems(entry: Entry, line: Line, cfg: number | null) {
    const info = await line.call<DeviceInfo>("Zh.GetInfo");
    entry.items = await deps.syncItems(entry.p.deviceId, info);
    entry.p.cfg = cfg;
  }

  /** The device says which newer version it found: note it, with its notes, and tell the owner once. */
  async function noteUpdate(entry: Entry, line: Line, latest: string) {
    if ((entry.update?.latest ?? "") === latest) return;
    if (!latest) {
      entry.update = null;
      return;
    }
    let notes = "";
    try {
      notes = (await line.call<DeviceUpdate>("Zh.GetUpdate")).notes ?? "";
    } catch {
      /* the notes come with the next status */
    }
    entry.update = { latest, notes };
    deps.updateReady?.({ deviceId: entry.p.deviceId, deviceName: entry.p.deviceName, version: line.hello.version, latest, notes });
  }

  function apply(entry: Entry, status: DeviceStatus) {
    entry.health = {
      rssi: typeof status.rssi === "number" ? status.rssi : null,
      uptimeS: typeof status.uptime === "number" ? status.uptime : null,
      at: Date.now(),
    };
    for (const r of readStatus(status, entry.items)) {
      deps.path.reportItem(r.itemId, r.value, {
        kind: r.kind,
        retained: false,
        history: r.kind === "switch" ? null : { deviceSlug: entry.p.deviceSlug, entityId: r.slug },
      });
    }
  }

  async function heard(entry: Entry, line: Line, status: DeviceStatus) {
    if (entry.line !== line) return;
    entry.lastHeard = Date.now();
    deps.path.deviceHeard([entry.p.deviceId]);
    const cfg = typeof status.cfg === "number" ? status.cfg : null;
    if (cfg !== null && cfg !== entry.p.cfg) {
      await readItems(entry, line, cfg);
      deps.saveSeen(entry.p.deviceId, { address: entry.p.address, cfg, version: line.hello.version });
    }
    apply(entry, status);
    if (typeof status.update === "string") await noteUpdate(entry, line, status.update);
  }

  /**
   * Tell the device Nexternel's name when it knows another one. A device older than Zherodius 1.11.2
   * does not understand the ask: it keeps the earlier name, and nothing else changes (tried again on
   * the next line opening).
   */
  async function tellName(entry: Entry, line: Line) {
    const name = await deps.hubName().catch(() => "");
    if (!name || name === entry.p.hubName) return;
    try {
      await line.call("Zh.SetHubName", { name });
    } catch {
      return;
    }
    entry.p.hubName = name;
    deps.saveHubName(entry.p.deviceId, name);
  }

  async function open(entry: Entry, hub: X25519Key): Promise<Line> {
    const opts = (address: string) => ({
      address,
      hub,
      deviceKey: entry.p.deviceKey,
      serial: entry.p.serial,
      onStatus: (s: DeviceStatus) => {
        const line = entry.line;
        if (line) void queue(entry, () => heard(entry, line, s)).catch(() => undefined);
      },
      onClose: () => closed(entry),
      linePort: deps.linePort,
    });
    try {
      return await openLine(opts(entry.p.address));
    } catch (err) {
      // Not at its address (any more): look for it by its serial number.
      if (!(err instanceof LineError) || !/^No answer|^Another device/.test(err.message)) throw err;
      const found = await deps.findAddress(entry.p.serial).catch(() => null);
      if (!found || found === entry.p.address) throw err;
      const line = await openLine(opts(found));
      entry.p.address = found;
      return line;
    }
  }

  async function connect(entry: Entry): Promise<void> {
    if (entry.stopped || entry.line || entry.connecting) return;
    entry.connecting = true;
    let line: Line | null = null;
    try {
      line = await open(entry, await deps.hubKey());
      if (entry.stopped) {
        line.close();
        return;
      }
      const opened = line;
      entry.line = opened;
      entry.lastHeard = Date.now();
      await queue(entry, async () => {
        const status = await opened.call<DeviceStatus>("Zh.GetStatus");
        const cfg = typeof status.cfg === "number" ? status.cfg : null;
        if (!entry.items.size || cfg !== entry.p.cfg) await readItems(entry, opened, cfg);
        deps.saveSeen(entry.p.deviceId, { address: entry.p.address, cfg: entry.p.cfg, version: opened.hello.version });
        deps.path.deviceOnline([entry.p.deviceId]);
        apply(entry, status);
        await tellName(entry, opened);
        // What it found before this line opened (an older device has no "update": nothing to note).
        if (typeof status.update === "string") await noteUpdate(entry, opened, status.update);
        else entry.update = null;
      });
      if (entry.line === line) {
        entry.attempt = 0;
        setNeedsPairing(entry.p.deviceId, null);
        tell(entry, null);
      }
    } catch (err) {
      // Not open after all (it closed while being set up, or the device stopped answering).
      if (line && entry.line === line) {
        entry.line = null;
        line.close();
      }
      tell(entry, err instanceof LineError ? err.message : "the direct line could not be opened");
      if (err instanceof NotPairedError) {
        setNeedsPairing(entry.p.deviceId, err.why);
        scheduleRetry(entry, notPairedRetryMs);
      } else scheduleRetry(entry);
    } finally {
      entry.connecting = false;
    }
  }

  function closed(entry: Entry) {
    if (!entry.line) return;
    entry.line = null;
    deps.path.deviceOffline([entry.p.deviceId]);
    scheduleRetry(entry);
  }

  function startWatchdog() {
    if (watchdog) return;
    watchdog = setInterval(() => {
      const now = Date.now();
      for (const e of entries.values()) if (e.line && now - e.lastHeard > silentMs) e.line.close();
    }, Math.min(15_000, silentMs));
    watchdog.unref?.();
  }

  /** Keep a line open to this paired device (also after pairing it again). */
  async function add(p: Pairing): Promise<void> {
    forget(p.deviceId);
    const entry: Entry = {
      p,
      line: null,
      connecting: false,
      stopped: false,
      attempt: 0,
      retry: null,
      lastHeard: 0,
      items: await deps.itemsOf(p.deviceId),
      problem: null,
      chain: Promise.resolve(),
      health: null,
      update: null,
    };
    entries.set(p.deviceId, entry);
    startWatchdog();
    await connect(entry);
  }

  /** The device's items changed in Nexternel (it replaced an earlier device): read them again and report their values. */
  async function refreshItems(deviceId: string): Promise<void> {
    const entry = entries.get(deviceId);
    if (!entry) return;
    entry.items = await deps.itemsOf(deviceId);
    const line = entry.line;
    if (line) {
      await queue(entry, async () => apply(entry, await line.call<DeviceStatus>("Zh.GetStatus"))).catch(() => undefined);
    }
  }

  /** The device was removed from Nexternel: its line ends and is not opened again. */
  function forget(deviceId: string) {
    setNeedsPairing(deviceId, null);
    const entry = entries.get(deviceId);
    if (!entry) return;
    entry.stopped = true;
    if (entry.retry) clearTimeout(entry.retry);
    entries.delete(deviceId);
    const line = entry.line;
    entry.line = null;
    line?.close();
  }

  /**
   * The device was removed from Nexternel: ask it to forget Nexternel too (it keeps only 3 hubs), then end
   * its line. A device that is not connected right now gets one try to open the line first.
   * Gives "done", "old" (its firmware is older than Zherodius 1.11.9 and cannot be asked) or "unreachable".
   */
  async function unpair(deviceId: string): Promise<"done" | "old" | "unreachable" | "unknown"> {
    const entry = entries.get(deviceId);
    if (!entry) return "unknown";
    entry.stopped = true;
    if (entry.retry) clearTimeout(entry.retry);
    entry.retry = null;
    let line = entry.line;
    let mine = false;
    try {
      if (!line) {
        line = await open(entry, await deps.hubKey());
        mine = true;
      }
      await line.call("Zh.Unpair", undefined, UNPAIR_ANSWER_MS);
      return "done";
    } catch (err) {
      return err instanceof LineError && /^Unknown method/.test(err.message) ? "old" : "unreachable";
    } finally {
      if (mine) line?.close();
      forget(deviceId);
    }
  }

  const sender: ItemSender = {
    unavailable(item: CapabilityRow) {
      const found = entryOfItem(item.id);
      if (!found) return "Nexternel has no line to this device";
      return found.entry.line ? null : `${found.entry.p.deviceName} is not connected`;
    },
    async send(item: CapabilityRow, on: boolean) {
      const found = entryOfItem(item.id);
      const m = found ? /^relay_(\d+)$/.exec(found.slug) : null;
      const line = found?.entry.line;
      if (!found || !m || !line) throw new Error("Nexternel has no line to this device");
      try {
        const r = await line.call<{ on?: boolean }>("Relay.Set", { id: Number(m[1]), on }, PRESS_ANSWER_MS);
        // The device's answer is its report of the new position.
        if (typeof r?.on === "boolean") deps.path.reportItem(item.id, r.on, { kind: "switch", retained: false });
      } catch (err) {
        // No answer yet: the shared path waits for the device's report and decides.
        if (err instanceof NoAnswerError) return;
        throw err;
      }
    },
  };

  return {
    async start() {
      for (const p of await deps.listPairings()) void add(p);
    },
    add,
    forget,
    unpair,
    refreshItems,
    /** Nexternel's name changed: tell every device on an open line. */
    tellNames() {
      for (const e of entries.values()) {
        const line = e.line;
        if (line) void queue(e, () => tellName(e, line)).catch(() => undefined);
      }
    },
    sender,
    /** Whether the line to this device is open (for the device page). */
    isOpen: (deviceId: string) => Boolean(entries.get(deviceId)?.line),
    hello: (deviceId: string): Hello | null => entries.get(deviceId)?.line?.hello ?? null,
    /** The newer Zherodius the device found, with its notes (null: none found, not connected, or too old to say). */
    updateOf: (deviceId: string): { latest: string; notes: string } | null => entries.get(deviceId)?.update ?? null,
    /** Ask the device about its updates; `what` starts its check or its install (Zherodius 1.12.1+). */
    async askUpdate(deviceId: string, what?: "check" | "install"): Promise<DeviceUpdate> {
      const e = entries.get(deviceId);
      const line = e?.line;
      if (!e || !line) throw new LineError(`${e?.p.deviceName ?? "The device"} is not connected to Nexternel right now.`);
      if (!updatesFromHub(line.hello.version)) {
        throw new LineError(`${e.p.deviceName} runs Zherodius ${line.hello.version}, which can't be updated from Nexternel yet: update it once on its own page (Firmware).`);
      }
      const u = what ? await line.call<DeviceUpdate>("Zh.Update", { do: what }) : await line.call<DeviceUpdate>("Zh.GetUpdate");
      if (!what || what === "check") {
        // What it knows now (a check runs in the background; its result comes with the next status).
        if (u.latest && u.latest !== e.update?.latest) await noteUpdate(e, line, u.latest);
        else if (!u.latest && u.state !== "checking") e.update = null;
      }
      return u;
    },
    /** Wi-Fi signal (dBm) and when the device last started, from its latest status on an open line. */
    health(deviceId: string): { wifiDbm: number | null; wifiAt: string | null; restartedAt: string | null } | null {
      const e = entries.get(deviceId);
      if (!e?.line || !e.health) return null;
      const { rssi, uptimeS, at } = e.health;
      return {
        wifiDbm: rssi,
        wifiAt: new Date(at).toISOString(),
        restartedAt: uptimeS === null ? null : new Date(Math.round((at - uptimeS * 1000) / 1000) * 1000).toISOString(),
      };
    },
    stop() {
      for (const id of [...entries.keys()]) forget(id);
      if (watchdog) clearInterval(watchdog);
      watchdog = null;
    },
  };
}

export type ZherodiusConnections = ReturnType<typeof createZherodiusConnections>;
