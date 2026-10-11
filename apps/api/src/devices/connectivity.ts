/** Operator-facing device connectivity — derived at read time, not a naive MQTT silence timeout. */

export type DeviceConnectivityState = "online" | "no_recent_data" | "offline";

export type MqttAvailability = "online" | "offline" | "unknown";

const MS_MIN = 60_000;

/** Switch / relay: recent command or state counts as online. */
export const CONNECTIVITY_SWITCH_ACTIVE_MS = 15 * MS_MIN;

/** Sensors and mixed devices: longer active window. */
export const CONNECTIVITY_SENSOR_ACTIVE_MS = 30 * MS_MIN;

/** Silence without proof of failure → "No recent data", not Offline. */
export const CONNECTIVITY_NO_RECENT_MS = 24 * 60 * MS_MIN;

/** Octopus: online within poll interval + slack. */
export const CONNECTIVITY_OCTOPUS_SLACK_MS = 5 * MS_MIN;

export type CapabilityLiveHint = {
  kind: string;
  quality: string;
  updatedAt: string;
};

export type ConnectivityInput = {
  firmwareType: string;
  isEnabled: boolean;
  mqttAvailability: MqttAvailability;
  lastSeenAt: string | null;
  sensorCount: number;
  relayCount: number;
  capabilityLive: CapabilityLiveHint[];
  nowMs?: number;
};

function activeWindowMs(input: ConnectivityInput): number {
  const ft = input.firmwareType.toLowerCase();
  if (ft === "octopus") return CONNECTIVITY_OCTOPUS_SLACK_MS;
  if (input.relayCount > 0 && input.sensorCount === 0) {
    return CONNECTIVITY_SWITCH_ACTIVE_MS;
  }
  return CONNECTIVITY_SENSOR_ACTIVE_MS;
}

function ageMs(lastSeenAt: string | null, nowMs: number): number | null {
  if (!lastSeenAt) return null;
  const t = Date.parse(lastSeenAt);
  if (!Number.isFinite(t)) return null;
  return nowMs - t;
}

function hasFreshLiveCapability(
  input: ConnectivityInput,
  windowMs: number,
  nowMs: number
): boolean {
  for (const cap of input.capabilityLive) {
    if (cap.quality !== "good") continue;
    const capAge = ageMs(cap.updatedAt, nowMs);
    if (capAge !== null && capAge <= windowMs) return true;
  }
  return false;
}

export function deriveDeviceConnectivityState(
  input: ConnectivityInput
): DeviceConnectivityState {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = activeWindowMs(input);
  const lastAge = ageMs(input.lastSeenAt, nowMs);

  if (!input.isEnabled) {
    if (input.mqttAvailability === "offline") return "offline";
    return "no_recent_data";
  }

  if (input.mqttAvailability === "offline") {
    return "offline";
  }

  if (hasFreshLiveCapability(input, windowMs, nowMs)) {
    return "online";
  }

  if (lastAge !== null && lastAge <= windowMs) {
    return "online";
  }

  if (lastAge !== null && lastAge <= CONNECTIVITY_NO_RECENT_MS) {
    return "no_recent_data";
  }

  if (input.mqttAvailability === "online") {
    return "no_recent_data";
  }

  if (lastAge === null) {
    return "no_recent_data";
  }

  return "offline";
}
