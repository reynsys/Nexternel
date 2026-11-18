/**
 * Remap MQTT topic root segment: damnhome/garden-relays → nexternel/garden-relays
 * (and the same for full sensor/relay topics).
 */
export function remapTopicRoot(topic: string, newRoot: string): string {
  const root = newRoot.trim().replace(/^\/+|\/+$/g, "");
  const t = topic.trim();
  if (!root || !t) return t;
  const slash = t.indexOf("/");
  if (slash === -1) return root;
  return `${root}${t.slice(slash)}`;
}

/** Remap only when the topic's first segment is a known legacy installation root. */
export function remapTopicForLegacyRoots(
  topic: string,
  newRoot: string,
  legacyRoots: string[]
): string {
  const t = topic.trim();
  if (!t || legacyRoots.length === 0) return t;
  const slash = t.indexOf("/");
  const first = (slash === -1 ? t : t.slice(0, slash)).toLowerCase();
  const legacy = new Set(legacyRoots.map((r) => r.toLowerCase()));
  if (!legacy.has(first)) return t;
  return remapTopicRoot(t, newRoot);
}

export function applyTopicRootToPayload<
  T extends {
    devices: {
      mqttTopicPrefix: string | null;
      sensors: { mqttStateTopic: string | null }[];
      relays: { mqttStateTopic: string | null; mqttCommandTopic: string | null }[];
    }[];
  },
>(payload: T, newRoot: string): T {
  const root = newRoot.trim().replace(/^\/+|\/+$/g, "");
  if (!root) return payload;
  const remap = (t: string | null) => (t === null ? null : remapTopicRoot(t, root));

  return {
    ...payload,
    devices: payload.devices.map((d) => ({
      ...d,
      mqttTopicPrefix: remap(d.mqttTopicPrefix),
      sensors: d.sensors.map((s) => ({
        ...s,
        mqttStateTopic: remap(s.mqttStateTopic),
      })),
      relays: d.relays.map((r) => ({
        ...r,
        mqttStateTopic: remap(r.mqttStateTopic),
        mqttCommandTopic: remap(r.mqttCommandTopic),
      })),
    })),
  };
}

export function applyLegacyTopicRootToPayload<
  T extends {
    devices: {
      mqttTopicPrefix: string | null;
      sensors: { mqttStateTopic: string | null }[];
      relays: { mqttStateTopic: string | null; mqttCommandTopic: string | null }[];
    }[];
  },
>(payload: T, newRoot: string, legacyRoots: string[]): T {
  const root = newRoot.trim().replace(/^\/+|\/+$/g, "");
  if (!root || legacyRoots.length === 0) return payload;
  const remap = (t: string | null) => (t === null ? null : remapTopicForLegacyRoots(t, root, legacyRoots));

  return {
    ...payload,
    devices: payload.devices.map((d) => ({
      ...d,
      mqttTopicPrefix: remap(d.mqttTopicPrefix),
      sensors: d.sensors.map((s) => ({
        ...s,
        mqttStateTopic: remap(s.mqttStateTopic),
      })),
      relays: d.relays.map((r) => ({
        ...r,
        mqttStateTopic: remap(r.mqttStateTopic),
        mqttCommandTopic: remap(r.mqttCommandTopic),
      })),
    })),
  };
}
