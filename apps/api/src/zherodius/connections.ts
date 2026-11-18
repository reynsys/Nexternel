/**
 * The Zherodius connection: Nexternel keeps one direct line open to every paired Zherodius device and
 * hands everything to the shared device path (devices/device-path.ts):
 * - the line open = online; the line closed (or silent too long) = offline, then it is opened again;
 * - every status the device sends (at once after each change, and at least every 30 s) = its readings;
 * - a changed `cfg` (names or parts changed on the device) = its items are read again (Zh.GetInfo);
 * - a press = Relay.Set over the line; the device's answer confirms it.
 * A device that moved to another address is found again by its serial number on the home network.
 */
import type { CapabilityRow } from "../capabilities/store.js";
import type { DevicePath, ItemSender } from "../devices/device-path.js";
import { readStatus, type ItemMap } from "./items.js";
import type { X25519Key } from "./line-crypto.js";
import { LineError, NoAnswerError, openLine, type DeviceInfo, type DeviceStatus, type Hello, type Line } from "./line.js";

export type Pairing = {
  deviceId: string;
  deviceName: string;
  deviceSlug: string;
  serial: string;
  address: string;
  deviceKey: string;
  /** The device's cfg mark when its items were last read (null: not read yet). */
  cfg: number | null;
};

export type ConnectionsDeps = {
  hubKey(): Promise<X25519Key>;
  listPairings(): Promise<Pairing[]>;
  itemsOf(deviceId: string): Promise<ItemMap>;
  /** Make the device's items match what it says it is made of; gives the items as they are now. */
  syncItems(deviceId: string, info: DeviceInfo): Promise<ItemMap>;
  saveSeen(deviceId: string, seen: { address: string; cfg: number | null; version: string }): void;
  /** The device's address on the home network now, found by its serial number (null: not seen). */
  findAddress(serial: string): Promise<string | null>;
  path: Pick<DevicePath, "reportItem" | "deviceOnline" | "deviceOffline" | "deviceHeard">;
  logActivity(entry: { deviceId: string; text: string }): void;
  /** Waits between tries to open a line (the last one repeats). */
  retryMs?: number[];
  /** A line the device has said nothing on for this long is taken as gone. */
  silentMs?: number;
};

/** The device sends its status at least every 30 seconds: two missed ones and a bit = gone. */
const SILENT_MS = 75_000;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];
/** Longer than the shared path waits for a press, so the shared path decides about "no answer". */
const PRESS_ANSWER_MS = 7_000;

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
};

export function createZherodiusConnections(deps: ConnectionsDeps) {
  const entries = new Map<string, Entry>();
  const retryMs = deps.retryMs ?? RETRY_MS;
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

  function scheduleRetry(entry: Entry) {
    if (entry.stopped || entry.retry) return;
    const wait = retryMs[Math.min(entry.attempt, retryMs.length - 1)]!;
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
      });
      if (entry.line === line) {
        entry.attempt = 0;
        tell(entry, null);
      }
    } catch (err) {
      // Not open after all (it closed while being set up, or the device stopped answering).
      if (line && entry.line === line) {
        entry.line = null;
        line.close();
      }
      tell(entry, err instanceof LineError ? err.message : "the direct line could not be opened");
      scheduleRetry(entry);
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
    const entry = entries.get(deviceId);
    if (!entry) return;
    entry.stopped = true;
    if (entry.retry) clearTimeout(entry.retry);
    entries.delete(deviceId);
    const line = entry.line;
    entry.line = null;
    line?.close();
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
    refreshItems,
    sender,
    /** Whether the line to this device is open (for the device page). */
    isOpen: (deviceId: string) => Boolean(entries.get(deviceId)?.line),
    hello: (deviceId: string): Hello | null => entries.get(deviceId)?.line?.hello ?? null,
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
