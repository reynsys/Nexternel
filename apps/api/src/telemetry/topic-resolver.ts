import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import {
  esphomeDevicePrefixAliases,
  esphomeSensorStateTopic,
  esphomeSwitchStateTopic,
} from "./esphome-topics.js";

export type LiveTopicBinding = {
  capabilityId: string;
  kind: string;
};

const ESPHOME_STATE_TOPIC_RE = /^(.+)\/(sensor|switch)\/([^/]+)\/state$/;

/** In-memory exact topic → capability (rebuilt on MQTT connect / subscription refresh). */
const liveTopicMap = new Map<string, LiveTopicBinding[]>();

export function registerLiveTopicBinding(
  topic: string,
  capabilityId: string,
  kind: string
): void {
  const t = topic.trim();
  if (!t) return;
  const list = liveTopicMap.get(t) ?? [];
  if (!list.some((e) => e.capabilityId === capabilityId)) {
    list.push({ capabilityId, kind });
    liveTopicMap.set(t, list);
  }
}

export function clearLiveTopicMap(): void {
  liveTopicMap.clear();
}

export function getLiveTopicBindings(topic: string): LiveTopicBinding[] {
  return liveTopicMap.get(topic) ?? [];
}

export function getLiveTopicMapSize(): number {
  return liveTopicMap.size;
}

export type EsphomeTopicParts = {
  prefix: string;
  segment: "sensor" | "switch";
  entityId: string;
  slug: string | null;
};

export function parseEsphomeStateTopic(topic: string): EsphomeTopicParts | null {
  const m = ESPHOME_STATE_TOPIC_RE.exec(topic.trim());
  if (!m) return null;
  const prefix = m[1]!;
  const segment = m[2] as "sensor" | "switch";
  const entityId = m[3]!;
  const slash = prefix.indexOf("/");
  const slug = slash === -1 ? null : prefix.slice(slash + 1) || null;
  return { prefix, segment, entityId, slug };
}

/** Register canonical + alias topics for one ESPHome entity. */
export function registerEsphomeEntityTopics(input: {
  capabilityId: string;
  kind: string;
  devicePrefix: string;
  deviceSlug: string;
  entityId: string;
  segment: "sensor" | "switch";
}): void {
  const installRoot = installationMqttRoot();
  for (const prefix of esphomeDevicePrefixAliases(
    input.devicePrefix,
    input.deviceSlug,
    installRoot
  )) {
    const topic =
      input.segment === "sensor"
        ? esphomeSensorStateTopic(prefix, input.entityId)
        : esphomeSwitchStateTopic(prefix, input.entityId);
    registerLiveTopicBinding(topic, input.capabilityId, input.kind);
  }
}
