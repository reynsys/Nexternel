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
      mqttTopicPrefix: string;
      sensors: { mqttStateTopic: string }[];
      relays: { mqttStateTopic: string; mqttCommandTopic: string }[];
    }[];
  },
>(payload: T, newRoot: string): T {
  const root = newRoot.trim().replace(/^\/+|\/+$/g, "");
  if (!root) return payload;

  return {
    ...payload,
    devices: payload.devices.map((d) => ({
      ...d,
      mqttTopicPrefix: remapTopicRoot(d.mqttTopicPrefix, root),
      sensors: d.sensors.map((s) => ({
        ...s,
        mqttStateTopic: remapTopicRoot(s.mqttStateTopic, root),
      })),
      relays: d.relays.map((r) => ({
        ...r,
        mqttStateTopic: remapTopicRoot(r.mqttStateTopic, root),
        mqttCommandTopic: remapTopicRoot(r.mqttCommandTopic, root),
      })),
    })),
  };
}

export function applyLegacyTopicRootToPayload<
  T extends {
    devices: {
      mqttTopicPrefix: string;
      sensors: { mqttStateTopic: string }[];
      relays: { mqttStateTopic: string; mqttCommandTopic: string }[];
    }[];
  },
>(payload: T, newRoot: string, legacyRoots: string[]): T {
  const root = newRoot.trim().replace(/^\/+|\/+$/g, "");
  if (!root || legacyRoots.length === 0) return payload;

  return {
    ...payload,
    devices: payload.devices.map((d) => ({
      ...d,
      mqttTopicPrefix: remapTopicForLegacyRoots(d.mqttTopicPrefix, root, legacyRoots),
      sensors: d.sensors.map((s) => ({
        ...s,
        mqttStateTopic: remapTopicForLegacyRoots(s.mqttStateTopic, root, legacyRoots),
      })),
      relays: d.relays.map((r) => ({
        ...r,
        mqttStateTopic: remapTopicForLegacyRoots(r.mqttStateTopic, root, legacyRoots),
        mqttCommandTopic: remapTopicForLegacyRoots(r.mqttCommandTopic, root, legacyRoots),
      })),
    })),
  };
}
