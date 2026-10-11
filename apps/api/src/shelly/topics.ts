/**
 * Shelly MQTT topic helpers — Gen1 (shellies/…) and Gen2/Gen3 (command/switch:N).
 */

export const SHELLY_GEN1_ROOT = "shellies";

export function normalizeShellyTopicPrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, "");
}

/** True when the stored prefix uses Gen1 `shellies/{device-id}` layout. */
export function isShellyGen1MqttPrefix(prefix: string): boolean {
  const n = normalizeShellyTopicPrefix(prefix).toLowerCase();
  return n === SHELLY_GEN1_ROOT || n.startsWith(`${SHELLY_GEN1_ROOT}/`);
}

/** Strip optional `shellies/` root; returns device id (e.g. shelly1-B929CC). */
export function normalizeShellyGen1DeviceId(deviceId: string): string {
  let s = normalizeShellyTopicPrefix(deviceId);
  const root = `${SHELLY_GEN1_ROOT}/`;
  if (s.toLowerCase().startsWith(root)) {
    s = s.slice(root.length);
  }
  return s;
}

/** Gen1 MQTT prefix stored on the device row: `shellies/shelly1-…`. */
export function buildShellyGen1TopicPrefix(deviceId: string): string {
  const id = normalizeShellyGen1DeviceId(deviceId);
  if (!id) throw new Error("Shelly device ID is required");
  return `${SHELLY_GEN1_ROOT}/${id}`;
}

export function buildShellySwitchTopics(
  topicPrefix: string,
  channel = 0
): { stateTopic: string; commandTopic: string; entityId: string; slug: string } {
  const prefix = normalizeShellyTopicPrefix(topicPrefix);
  if (!prefix) throw new Error("Shelly MQTT topic prefix is required");
  const ch = Number.isFinite(channel) && channel >= 0 ? Math.floor(channel) : 0;
  const entityId = `switch:${ch}`;
  return {
    entityId,
    slug: `switch_${ch}`,
    stateTopic: `${prefix}/status/switch:${ch}`,
    commandTopic: `${prefix}/command/switch:${ch}`,
  };
}

/** Gen1 relay topics under `shellies/{id}/relay/N`. */
export function buildShellyGen1RelayTopics(
  topicPrefixOrDeviceId: string,
  channel = 0
): { stateTopic: string; commandTopic: string; entityId: string; slug: string } {
  const prefix = isShellyGen1MqttPrefix(topicPrefixOrDeviceId)
    ? normalizeShellyTopicPrefix(topicPrefixOrDeviceId)
    : buildShellyGen1TopicPrefix(topicPrefixOrDeviceId);
  const ch = Number.isFinite(channel) && channel >= 0 ? Math.floor(channel) : 0;
  const entityId = `relay:${ch}`;
  return {
    entityId,
    slug: `relay_${ch}`,
    stateTopic: `${prefix}/relay/${ch}`,
    commandTopic: `${prefix}/relay/${ch}/command`,
  };
}

export type ShellySwitchSuggestion = {
  name: string;
  slug: string;
  esphomeEntityId: string;
  mqttCommandTopic: string;
  mqttStateTopic: string;
  gpioPin?: number;
};

/** One-channel switch device suggestion (legacy). Prefer suggestShellyDevice. */
export function suggestShellySwitch(opts: {
  name: string;
  topicPrefix: string;
  channel?: number;
  shellyGen?: 1 | 2;
}): {
  name: string;
  mqttTopicPrefix: string;
  firmwareType: "shelly";
  relays: ShellySwitchSuggestion[];
} {
  const name = opts.name.trim();
  if (!name) throw new Error("Name is required");
  const shellyGen = resolveShellyGen(opts.shellyGen, opts.topicPrefix);
  const mqttTopicPrefix =
    shellyGen === 1
      ? buildShellyGen1TopicPrefix(opts.topicPrefix)
      : normalizeShellyTopicPrefix(opts.topicPrefix);
  const ch = opts.channel ?? 0;
  const topics =
    shellyGen === 1
      ? buildShellyGen1RelayTopics(mqttTopicPrefix, ch)
      : buildShellySwitchTopics(mqttTopicPrefix, ch);
  return {
    name,
    mqttTopicPrefix,
    firmwareType: "shelly",
    relays: [
      {
        name: ch > 0 ? `${name} ${ch}` : name,
        slug: topics.slug,
        esphomeEntityId: topics.entityId,
        mqttCommandTopic: topics.commandTopic,
        mqttStateTopic: topics.stateTopic,
      },
    ],
  };
}

export function looksLikeShellyGen2CommandTopic(topic: string | null | undefined): boolean {
  if (!topic) return false;
  return /\/command\/switch:\d+$/i.test(topic);
}

export function looksLikeShellyGen1CommandTopic(topic: string | null | undefined): boolean {
  if (!topic) return false;
  return /\/relay\/\d+\/command$/i.test(topic);
}

/** True when MQTT topics look like Shelly Gen1 or Gen2/Gen3 control interface. */
export function looksLikeShellyCommandTopic(topic: string | null | undefined): boolean {
  return looksLikeShellyGen2CommandTopic(topic) || looksLikeShellyGen1CommandTopic(topic);
}

export function resolveShellyGen(
  explicit: number | null | undefined,
  topicPrefix: string
): 1 | 2 {
  if (explicit === 1) return 1;
  if (explicit === 2) return 2;
  if (isShellyGen1MqttPrefix(topicPrefix)) return 1;
  return 2;
}
