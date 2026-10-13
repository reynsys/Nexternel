/**
 * Status lights: each reading's colour (normal / keep an eye on it / act now / no recent reading).
 * Limits belong to the reading, so every dashboard shows the same colour, and the same limits drive
 * the bell. A colour only changes after the reading has stayed past a limit for a minute, so a
 * reading hovering on a limit does not flicker.
 */
import {
  checkStatusLimits,
  defaultStatusSettings,
  STATUS_WORDS,
  statusOf,
  statusReason,
  type StatusLightSettings,
  type StatusLimits,
  type StatusState,
} from "@nexternel/domain";
import { getPool } from "../db.js";
import { getAllLiveStates, subscribeLive, type LiveCapabilityState } from "../telemetry/state-cache.js";
import { listCapabilities } from "./store.js";

export const STATUS_SETTLE_MS = 60_000;
const SWEEP_MS = 10_000;
const RELOAD_MS = 5 * 60_000;

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS capability_status_limits (
    capability_id    UUID PRIMARY KEY REFERENCES capabilities(id) ON DELETE CASCADE,
    enabled          BOOLEAN NOT NULL DEFAULT TRUE,
    alert_low        DOUBLE PRECISION,
    watch_low        DOUBLE PRECISION,
    watch_high       DOUBLE PRECISION,
    alert_high       DOUBLE PRECISION,
    notify_after_min INTEGER,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function ensureStatusLightSchema(): Promise<void> {
  await getPool().query(ENSURE_SQL);
}

type LimitsRow = {
  capability_id: string;
  enabled: boolean;
  alert_low: number | null;
  watch_low: number | null;
  watch_high: number | null;
  alert_high: number | null;
  notify_after_min: number | null;
};

const rowToSettings = (r: LimitsRow): StatusLightSettings => ({
  enabled: r.enabled,
  limits: { alertLow: r.alert_low, watchLow: r.watch_low, watchHigh: r.watch_high, alertHigh: r.alert_high },
  notifyAfterMin: r.notify_after_min,
});

export async function loadCustomStatusSettings(): Promise<Map<string, StatusLightSettings>> {
  const r = await getPool().query<LimitsRow>(
    `SELECT capability_id, enabled, alert_low, watch_low, watch_high, alert_high, notify_after_min
     FROM capability_status_limits`
  );
  return new Map(r.rows.map((row) => [row.capability_id, rowToSettings(row)]));
}

const finiteOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error("Limits must be numbers");
  return n;
};

/** Read and check settings sent by a screen. Throws a plain-language message when they make no sense. */
export function parseStatusSettings(body: unknown): StatusLightSettings {
  const b = (body ?? {}) as Record<string, unknown>;
  const l = (b.limits ?? {}) as Record<string, unknown>;
  const limits: StatusLimits = {
    alertLow: finiteOrNull(l.alertLow),
    watchLow: finiteOrNull(l.watchLow),
    watchHigh: finiteOrNull(l.watchHigh),
    alertHigh: finiteOrNull(l.alertHigh),
  };
  const problem = checkStatusLimits(limits);
  if (problem) throw new Error(problem);
  let notifyAfterMin: number | null = null;
  if (b.notifyAfterMin !== null && b.notifyAfterMin !== undefined && b.notifyAfterMin !== "") {
    const n = Number(b.notifyAfterMin);
    if (!Number.isInteger(n) || n < 1 || n > 24 * 60) throw new Error("Minutes before a bell alert must be 1 to 1440");
    notifyAfterMin = n;
  }
  return { enabled: b.enabled !== false, limits, notifyAfterMin };
}

export async function saveStatusSettings(capabilityId: string, s: StatusLightSettings): Promise<void> {
  await getPool().query(
    `INSERT INTO capability_status_limits
       (capability_id, enabled, alert_low, watch_low, watch_high, alert_high, notify_after_min, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (capability_id) DO UPDATE SET
       enabled = EXCLUDED.enabled, alert_low = EXCLUDED.alert_low, watch_low = EXCLUDED.watch_low,
       watch_high = EXCLUDED.watch_high, alert_high = EXCLUDED.alert_high,
       notify_after_min = EXCLUDED.notify_after_min, updated_at = NOW()`,
    [
      capabilityId,
      s.enabled,
      s.limits.alertLow ?? null,
      s.limits.watchLow ?? null,
      s.limits.watchHigh ?? null,
      s.limits.alertHigh ?? null,
      s.notifyAfterMin,
    ]
  );
  await statusEngine.reload();
}

export async function resetStatusSettings(capabilityId: string): Promise<void> {
  await getPool().query(`DELETE FROM capability_status_limits WHERE capability_id = $1::uuid`, [capabilityId]);
  await statusEngine.reload();
}

/** What a screen needs to draw one reading's light. */
export type CapabilityStatus = {
  capabilityId: string;
  /** null = this reading has no light (no limits, switched off, or not a number). */
  state: StatusState | null;
  since: string | null;
  settings: StatusLightSettings | null;
  /** true = limits were changed for this reading; false = the starting limits for its kind. */
  custom: boolean;
};

export type StatusEvent = { type: "capability.status"; status: CapabilityStatus };

type Notifier = (n: { level: "alert" | "info"; title: string; body: string }) => Promise<unknown>;

type Entry = {
  name: string;
  area: string | null;
  unit: string | null;
  settings: StatusLightSettings | null;
  custom: boolean;
  state: StatusState | null;
  since: number | null;
  candidate: { state: StatusState; since: number } | null;
  lastValue: unknown;
  /** A bell alert was sent for the current "act now" spell. */
  alerted: boolean;
};

/** Works out each reading's colour from its live values. Kept separate from timers so tests can drive the clock. */
export class StatusEngine {
  private entries = new Map<string, Entry>();
  private listeners = new Set<(e: StatusEvent) => void>();

  constructor(
    private notify: Notifier,
    private now: () => number = Date.now
  ) {}

  /** Replace the list of readings and their settings, keeping each reading's current colour. */
  configure(
    caps: { id: string; kind: string; name: string; area: string | null; unit: string | null }[],
    custom: Map<string, StatusLightSettings>
  ): void {
    const next = new Map<string, Entry>();
    for (const c of caps) {
      const own = custom.get(c.id);
      const settings = own ?? defaultStatusSettings(c.kind);
      const prev = this.entries.get(c.id);
      next.set(c.id, {
        name: c.name,
        area: c.area,
        unit: c.unit,
        settings,
        custom: Boolean(own),
        state: prev?.state ?? null,
        since: prev?.since ?? null,
        candidate: null,
        lastValue: prev?.lastValue,
        alerted: prev?.alerted ?? false,
      });
    }
    const changed = [...next.keys()].filter((id) => {
      const a = this.entries.get(id)?.settings;
      return JSON.stringify(a ?? null) !== JSON.stringify(next.get(id)!.settings);
    });
    this.entries = next;
    // New limits apply straight away; there is nothing to wait for. Screens hear about the new
    // limits even when the colour stays the same.
    for (const id of changed) {
      const before = this.entries.get(id)!.state;
      this.reevaluate(id, true);
      if (this.entries.get(id)!.state === before) this.emit(id, this.entries.get(id)!);
    }
  }

  subscribe(listener: (e: StatusEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get(capabilityId: string): CapabilityStatus | null {
    const e = this.entries.get(capabilityId);
    return e ? this.toStatus(capabilityId, e) : null;
  }

  all(): CapabilityStatus[] {
    // Every reading that has limits, even before its first value, so screens can show and edit them.
    return [...this.entries].filter(([, e]) => e.settings !== null).map(([id, e]) => this.toStatus(id, e));
  }

  private toStatus(id: string, e: Entry): CapabilityStatus {
    return {
      capabilityId: id,
      state: e.state,
      since: e.since ? new Date(e.since).toISOString() : null,
      settings: e.settings,
      custom: e.custom,
    };
  }

  private raw(e: Entry, live: Pick<LiveCapabilityState, "value" | "quality"> | null): StatusState | null {
    if (!e.settings || !e.settings.enabled) return null;
    if (!live) return null;
    const s = statusOf(live.value, e.settings.limits);
    if (s === null) return null;
    return live.quality === "good" ? s : "stale";
  }

  /** A new live value for a reading. */
  update(state: Pick<LiveCapabilityState, "capabilityId" | "value" | "quality">): void {
    this.remember(state);
    const e = this.entries.get(state.capabilityId);
    if (!e) return;
    e.lastValue = state.value;
    this.apply(state.capabilityId, e, this.raw(e, state), false);
  }

  private lastLive = new Map<string, Pick<LiveCapabilityState, "value" | "quality">>();

  /** Remember live values so changed limits can be applied at once. */
  private remember(state: Pick<LiveCapabilityState, "capabilityId" | "value" | "quality">): void {
    this.lastLive.set(state.capabilityId, { value: state.value, quality: state.quality });
  }

  private reevaluate(id: string, immediate: boolean): void {
    const e = this.entries.get(id)!;
    this.apply(id, e, this.raw(e, this.lastLive.get(id) ?? null), immediate);
  }

  private apply(id: string, e: Entry, raw: StatusState | null, immediate: boolean): void {
    if (raw === e.state) {
      e.candidate = null;
      return;
    }
    // No light yet, a light going away, or a reading going quiet / coming back: show it at once.
    // Only moves between normal / keep an eye on it / act now wait a minute.
    const waits = !immediate && e.state !== null && raw !== null && e.state !== "stale" && raw !== "stale";
    if (!waits) {
      this.commit(id, e, raw);
      return;
    }
    if (!e.candidate || e.candidate.state !== raw) e.candidate = { state: raw, since: this.now() };
  }

  private commit(id: string, e: Entry, state: StatusState | null): void {
    const was = e.state;
    e.state = state;
    e.since = state === null ? null : this.now();
    e.candidate = null;
    if (e.alerted && (state === "ok" || state === "watch" || state === null)) {
      e.alerted = false;
      if (state !== null) {
        void this.notify({
          level: "info",
          title: `${this.label(e)} is back to ${STATUS_WORDS[state]}`,
          body: this.describe(e, state),
        }).catch(() => undefined);
      }
    }
    if (was !== state) this.emit(id, e);
  }

  private emit(id: string, e: Entry): void {
    const event: StatusEvent = { type: "capability.status", status: this.toStatus(id, e) };
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  /** Commit colours that have held for a minute, and send bell alerts that are due. */
  sweep(): void {
    const t = this.now();
    for (const [id, e] of this.entries) {
      if (e.candidate && t - e.candidate.since >= STATUS_SETTLE_MS) this.commit(id, e, e.candidate.state);
      const after = e.settings?.notifyAfterMin;
      if (e.state === "alert" && !e.alerted && after && e.since !== null && t - e.since >= after * 60_000) {
        e.alerted = true;
        void this.notify({
          level: "alert",
          title: `${this.label(e)}: act now`,
          body: `${this.describe(e, "alert")} for ${after} minute${after === 1 ? "" : "s"}.`,
        }).catch(() => undefined);
      }
    }
  }

  private label(e: Entry): string {
    return e.area && !e.name.toLowerCase().includes(e.area.toLowerCase()) ? `${e.area} ${e.name}` : e.name;
  }

  private describe(e: Entry, state: StatusState): string {
    const v = typeof e.lastValue === "number" ? e.lastValue : Number(e.lastValue);
    if (!Number.isFinite(v) || !e.settings) return "";
    const u = e.unit ? ` ${e.unit}` : "";
    const reason = statusReason(v, e.settings.limits, state, e.unit);
    return state === "ok" ? `Now ${v}${u}.` : `${v}${u}, ${reason}`;
  }

  // --- wiring to the running server ---

  private started = false;

  async reload(): Promise<void> {
    const [caps, custom] = await Promise.all([listCapabilities(), loadCustomStatusSettings()]);
    this.configure(
      caps.map((c) => ({ id: c.id, kind: c.kind, name: c.name, area: c.room_name, unit: c.unit })),
      custom
    );
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    for (const s of getAllLiveStates()) this.remember(s);
    await this.reload();
    for (const id of this.entries.keys()) this.reevaluate(id, true);
    subscribeLive(({ state }) => {
      this.update(state);
      if (!this.entries.has(state.capabilityId)) this.scheduleReload();
    });
    setInterval(() => this.sweep(), SWEEP_MS).unref?.();
    // Pick up renamed or new readings.
    setInterval(() => void this.reload().catch(() => undefined), RELOAD_MS).unref?.();
  }

  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleReload(): void {
    if (this.reloadTimer) return;
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      void this.reload()
        .then(() => {
          for (const id of this.entries.keys()) if (this.entries.get(id)!.state === null) this.reevaluate(id, true);
        })
        .catch(() => undefined);
    }, 5_000);
    this.reloadTimer.unref?.();
  }
}

export const statusEngine = new StatusEngine(async (n) => {
  const { addNotification } = await import("../notifications/service.js");
  return addNotification({ source: "system", sourceName: "Status lights", ...n });
});
