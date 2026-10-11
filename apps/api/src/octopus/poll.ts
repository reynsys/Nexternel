import { getLiveState, setLiveState } from "../telemetry/state-cache.js";
import { writeSensorReading } from "../history/influx.js";
import {
  fetchLiveDemandW,
  fetchTodayConsumptionKwh,
  fetchTodayGasConsumptionKwh,
  londonTodayRangeIso,
} from "./client.js";
import {
  ensureOctopusDeviceAndSensors,
  getOctopusSettings,
  listOctopusCapabilityIds,
  OCTOPUS_DEVICE_SLUG,
  recordOctopusPollResult,
} from "./service.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";

export type OctopusPollResult = {
  ok: boolean;
  error?: string;
  liveDemandW?: number | null;
  electricityTodayKwh?: number | null;
  gasTodayKwh?: number | null;
  cooldown?: boolean;
};

type PollOptions = {
  forTest?: boolean;
  includeDaily?: boolean;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let dailyPollCounter = 0;
let pollInFlightPromise: Promise<OctopusPollResult> | null = null;
let lastTestPollAt = 0;

const TEST_POLL_COOLDOWN_MS = 45_000;

/**
 * After a failed poll, wait before asking Octopus again. A failure did not move
 * `last_poll_at`, so the 15 s timer used to retry ~240 times an hour — which keeps Octopus's
 * rate limit (~100 calls/hour) from ever lifting. Rate limits back off 5 → 10 → 20 → 30 min.
 */
const RATE_LIMIT_BACKOFF_START_MS = 5 * 60_000;
const RATE_LIMIT_BACKOFF_MAX_MS = 30 * 60_000;
let retryNotBefore = 0;
let rateLimitBackoffMs = 0;

export function octopusRetryDelayMs(
  error: string,
  intervalMs: number,
  previousRateLimitBackoffMs: number
): { delayMs: number; rateLimitBackoffMs: number } {
  if (/rate limit|429|too many/i.test(error)) {
    const next = previousRateLimitBackoffMs
      ? Math.min(previousRateLimitBackoffMs * 2, RATE_LIMIT_BACKOFF_MAX_MS)
      : RATE_LIMIT_BACKOFF_START_MS;
    return { delayMs: next, rateLimitBackoffMs: next };
  }
  return { delayMs: intervalMs, rateLimitBackoffMs: 0 };
}

export function startOctopusPoller(): void {
  if (pollTimer) return;
  void triggerOctopusPoll(true, { includeDaily: true });
  pollTimer = setInterval(() => {
    void triggerOctopusPoll(false);
  }, 15_000);
  pollTimer.unref?.();
}

export function stopOctopusPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Run one Octopus poll (optionally bypass interval gate). */
export async function triggerOctopusPoll(
  force = false,
  options?: PollOptions
): Promise<void> {
  await runOctopusPollShared(force, options);
}

/** Manual test poll — single Octopus round-trip set, with cooldown. */
export async function triggerOctopusTestPoll(): Promise<OctopusPollResult> {
  const now = Date.now();
  if (lastTestPollAt && now - lastTestPollAt < TEST_POLL_COOLDOWN_MS) {
    const caps = await listOctopusCapabilityIds();
    const waitSec = Math.ceil((TEST_POLL_COOLDOWN_MS - (now - lastTestPollAt)) / 1000);
    return {
      ok: true,
      cooldown: true,
      error: `Wait ${waitSec}s before another test poll (Octopus rate limit).`,
      liveDemandW: readCachedNumber(caps.powerCapabilityId),
      electricityTodayKwh: readCachedNumber(caps.energyTodayCapabilityId),
      gasTodayKwh: readCachedNumber(caps.gasTodayCapabilityId),
    };
  }

  lastTestPollAt = now;
  return runOctopusPollShared(true, { forTest: true, includeDaily: true });
}

async function runOctopusPollShared(
  force: boolean,
  options?: PollOptions
): Promise<OctopusPollResult> {
  if (pollInFlightPromise) {
    return pollInFlightPromise;
  }

  pollInFlightPromise = runOctopusPoll(force, options).finally(() => {
    pollInFlightPromise = null;
  });
  return pollInFlightPromise;
}

function readCachedNumber(capabilityId: string | null): number | null {
  if (!capabilityId) return null;
  const value = getLiveState(capabilityId)?.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Mirror API-polled Octopus readings into Influx so Charts panels can query history. */
async function persistOctopusInfluxReading(
  entityId: string,
  value: number
): Promise<void> {
  try {
    await writeSensorReading({
      deviceSlug: OCTOPUS_DEVICE_SLUG,
      entityId,
      value,
    });
  } catch (err) {
    console.warn("octopus influx write failed", entityId, err);
  }
}

/** Keep API-polled Octopus values fresh between partial polls (daily is every Nth poll). */
function refreshCachedOctopusStates(caps: {
  powerCapabilityId: string | null;
  energyTodayCapabilityId: string | null;
  gasTodayCapabilityId: string | null;
}): void {
  for (const id of [
    caps.powerCapabilityId,
    caps.energyTodayCapabilityId,
    caps.gasTodayCapabilityId,
  ]) {
    if (!id) continue;
    const cached = getLiveState(id);
    if (!cached || cached.value === null || cached.value === undefined) continue;
    setLiveState(id, cached.value, { quality: "good" });
  }
}

async function runOctopusPoll(force: boolean, options?: PollOptions): Promise<OctopusPollResult> {
  const settings = await getOctopusSettings();
  if (!settings?.enabled && !options?.forTest) {
    return { ok: false, error: "Octopus polling is disabled" };
  }
  if (!settings?.api_key.trim() || !settings.account_number.trim()) {
    return { ok: false, error: "Account and API key required" };
  }

  const intervalMs = Math.max(30, settings.poll_interval_sec) * 1000;
  if (!force && !options?.forTest) {
    if (Date.now() < retryNotBefore) {
      return { ok: false, error: settings.last_error ?? "Waiting before retrying Octopus" };
    }
    const last = settings.last_poll_at ? Date.parse(settings.last_poll_at) : 0;
    if (last && Date.now() - last < intervalMs - 5_000) {
      return { ok: true };
    }
  }

  let caps = await listOctopusCapabilityIds();
  if (!caps.powerCapabilityId && !caps.energyTodayCapabilityId && !caps.gasTodayCapabilityId) {
    await ensureOctopusDeviceAndSensors();
    await syncCapabilitiesFromLegacy();
    caps = await listOctopusCapabilityIds();
  }
  if (!caps.powerCapabilityId && !caps.energyTodayCapabilityId && !caps.gasTodayCapabilityId) {
    const error = "Octopus capabilities missing — save settings again or Sync capabilities";
    await recordOctopusPollResult({ ok: false, error });
    return { ok: false, error };
  }

  const elecId = settings.electricity_device_id.trim();
  const gasId = settings.gas_device_id.trim();
  if (!elecId && !gasId) {
    const error = "Meter device ID missing — use Discover on System → Octopus";
    await recordOctopusPollResult({ ok: false, error });
    return { ok: false, error };
  }

  let liveDemandW: number | null = null;
  let electricityTodayKwh: number | null = null;
  let gasTodayKwh: number | null = null;

  try {
    if (elecId && caps.powerCapabilityId) {
      const live = await fetchLiveDemandW(settings.api_key, elecId);
      liveDemandW = live.demandW;
      if (live.demandW !== null) {
        setLiveState(caps.powerCapabilityId, live.demandW, { quality: "good" });
        await persistOctopusInfluxReading("live_power", live.demandW);
      }
    }

    dailyPollCounter += 1;
    const fetchDaily = options?.includeDaily ?? dailyPollCounter % 5 === 1;
    const range = londonTodayRangeIso();

    if (fetchDaily && elecId && caps.energyTodayCapabilityId) {
      const daily = await fetchTodayConsumptionKwh(settings.api_key, elecId, range);
      electricityTodayKwh = daily.kwh;
      if (daily.kwh !== null) {
        setLiveState(caps.energyTodayCapabilityId, daily.kwh, { quality: "good" });
        await persistOctopusInfluxReading("energy_today", daily.kwh);
      }
    }

    if (fetchDaily && gasId && caps.gasTodayCapabilityId) {
      const gasDaily = await fetchTodayGasConsumptionKwh(
        settings.api_key,
        gasId,
        range,
        settings.gas_consumption_units
      );
      gasTodayKwh = gasDaily.kwh;
      if (gasDaily.kwh !== null) {
        setLiveState(caps.gasTodayCapabilityId, gasDaily.kwh, { quality: "good" });
        await persistOctopusInfluxReading("gas_today", gasDaily.kwh);
      }
    }

    refreshCachedOctopusStates(caps);
    retryNotBefore = 0;
    rateLimitBackoffMs = 0;
    await recordOctopusPollResult({ ok: true });
    return {
      ok: true,
      liveDemandW,
      electricityTodayKwh,
      gasTodayKwh,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Octopus poll failed";
    const retry = octopusRetryDelayMs(message, intervalMs, rateLimitBackoffMs);
    rateLimitBackoffMs = retry.rateLimitBackoffMs;
    retryNotBefore = Date.now() + retry.delayMs;
    await recordOctopusPollResult({ ok: false, error: message });
    return { ok: false, error: message };
  }
}
