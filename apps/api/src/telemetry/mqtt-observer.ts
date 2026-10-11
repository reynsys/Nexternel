export type MqttObservationKind =
  | "capability_binding"
  | "shelly_switch"
  | "device_presence"
  | "esphome_heal"
  | "unmatched";

export type ObservedMqttMessage = {
  topic: string;
  payloadPreview: string;
  retained: boolean;
  receivedAt: string;
  kind: MqttObservationKind;
  capabilityIds: string[];
};

const RING_MAX = 500;
const ring: ObservedMqttMessage[] = [];

/** Broker-wide topic samples during an explicit admin sniff window. */
const sniffSamples = new Map<
  string,
  { count: number; lastAt: string; payloadPreview: string; retained: boolean }
>();
let sniffUntil = 0;

export function recordMqttObservation(msg: ObservedMqttMessage): void {
  ring.push(msg);
  if (ring.length > RING_MAX) ring.shift();

  if (Date.now() < sniffUntil) {
    const prev = sniffSamples.get(msg.topic);
    sniffSamples.set(msg.topic, {
      count: (prev?.count ?? 0) + 1,
      lastAt: msg.receivedAt,
      payloadPreview: msg.payloadPreview,
      retained: msg.retained,
    });
  }
}

export function getMqttObservationRing(limit = RING_MAX): ObservedMqttMessage[] {
  if (limit >= ring.length) return [...ring];
  return ring.slice(ring.length - limit);
}

export function getMessagesForTopicPrefix(prefix: string, limit = 50): ObservedMqttMessage[] {
  const p = prefix.trim();
  if (!p) return [];
  return ring
    .filter((m) => m.topic === p || m.topic.startsWith(`${p}/`))
    .slice(-limit);
}

export function startBrokerSniffWindow(durationMs: number): void {
  const ms = Math.min(Math.max(durationMs, 5_000), 120_000);
  sniffSamples.clear();
  sniffUntil = Date.now() + ms;
}

export function getBrokerSniffSamples(): {
  active: boolean;
  endsAt: string | null;
  topics: {
    topic: string;
    count: number;
    lastAt: string;
    payloadPreview: string;
    retained: boolean;
  }[];
} {
  const active = Date.now() < sniffUntil;
  const topics = [...sniffSamples.entries()]
    .map(([topic, v]) => ({ topic, ...v }))
    .sort((a, b) => b.count - a.count);
  return {
    active,
    endsAt: active ? new Date(sniffUntil).toISOString() : null,
    topics,
  };
}

export function clearBrokerSniffSamples(): void {
  sniffSamples.clear();
  sniffUntil = 0;
}
