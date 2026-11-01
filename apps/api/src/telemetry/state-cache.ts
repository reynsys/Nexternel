export type LiveQuality = "good" | "stale" | "unknown" | "error";

export type LiveCapabilityState = {
  capabilityId: string;
  value: unknown;
  quality: LiveQuality;
  updatedAt: string;
  retained?: boolean;
};

type Listener = (event: {
  type: "capability.updated";
  state: LiveCapabilityState;
}) => void;

const cache = new Map<string, LiveCapabilityState>();
const listeners = new Set<Listener>();

export function getLiveState(capabilityId: string): LiveCapabilityState | null {
  return cache.get(capabilityId) ?? null;
}

export function getAllLiveStates(): LiveCapabilityState[] {
  return [...cache.values()];
}

export function setLiveState(
  capabilityId: string,
  value: unknown,
  opts?: { quality?: LiveQuality; retained?: boolean }
): LiveCapabilityState {
  const prev = cache.get(capabilityId);
  // Do not let a retained MQTT echo immediately undo a fresher command write.
  if (
    opts?.retained &&
    prev &&
    !prev.retained &&
    prev.value !== value &&
    Date.now() - Date.parse(prev.updatedAt) < 2500
  ) {
    return prev;
  }

  const state: LiveCapabilityState = {
    capabilityId,
    value,
    quality: opts?.quality ?? "good",
    updatedAt: new Date().toISOString(),
    retained: opts?.retained,
  };
  cache.set(capabilityId, state);
  const event = { type: "capability.updated" as const, state };
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* ignore listener errors */
    }
  }
  return state;
}

/**
 * A board's way of saying it could not read its sensor: ESPHome sends "nan" (and "inf" from a failed
 * calculation). Such a reading is kept as no value, quality "error" — the board is fine, its sensor is not.
 */
export function isNoReading(value: unknown): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  return typeof value === "string" && /^[+-]?(nan|inf(inity)?)$/i.test(value.trim());
}

export function subscribeLive(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function parseMqttPayload(kind: string, payload: string): unknown {
  const raw = payload.trim();
  if (kind === "switch") {
    // Shelly Gen2/Gen3 status JSON: {"id":0,"output":true,...}
    if (raw.startsWith("{")) {
      try {
        const obj = JSON.parse(raw) as { output?: unknown };
        if (typeof obj.output === "boolean") return obj.output;
      } catch {
        /* fall through */
      }
    }
    const u = raw.toUpperCase();
    if (u === "ON" || u === "TRUE" || u === "1") return true;
    if (u === "OFF" || u === "FALSE" || u === "0") return false;
    return raw;
  }
  if (kind === "binary_sensor" || kind === "motion" || kind === "door") {
    const u = raw.toUpperCase();
    if (u === "ON" || u === "TRUE" || u === "1" || u === "OPEN") return true;
    if (u === "OFF" || u === "FALSE" || u === "0" || u === "CLOSED") return false;
    return raw;
  }
  const n = Number(raw);
  if (raw !== "" && Number.isFinite(n)) return n;
  return raw;
}
