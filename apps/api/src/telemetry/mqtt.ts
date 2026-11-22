import mqtt, { type MqttClient } from "mqtt";
import { config } from "../config.js";
import {
  listMqttDevices,
  listEsphomeLiveEntities,
  listShellySwitchBindings,
  listStateTopicBindings,
  type CapabilityRow,
} from "../capabilities/store.js";
import { parseMqttPayload } from "./state-cache.js";
import { getPool } from "../db.js";
import { devicePath } from "../devices/device-path-store.js";
import type { HistoryKey, ItemSender } from "../devices/device-path.js";
import { applyBoardHealthTopic, boardFingerprint } from "../devices/board-health.js";
import { applyBrokerLog, BROKER_LOG_TOPIC } from "./broker-log.js";
import { looksLikeShellyCommandTopic, isShellyGen1MqttPrefix } from "../shelly/topics.js";
import { parseShellyMqttSwitchUpdates } from "../shelly/notify.js";
import { createShellyPresenceCheck } from "../shelly/presence-check.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import {
  collectMqttSubscriptionTopics,
  deviceSlugFromMqttPrefix,
} from "./mqtt-subscriptions.js";
import { parseMqttSensorStateTopic } from "../history/mqtt-persist.js";
import {
  clearLiveTopicMap,
  getLiveTopicBindings,
  getLiveTopicMapSize,
  registerEsphomeEntityTopics,
  registerLiveTopicBinding,
} from "./topic-resolver.js";
import {
  getMqttObservationRing,
  getMessagesForTopicPrefix,
  recordMqttObservation,
  startBrokerSniffWindow,
  getBrokerSniffSamples,
  type MqttObservationKind,
} from "./mqtt-observer.js";
import { logActivity } from "../activity/activity.js";

let client: MqttClient | null = null;
let status: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
let lastError: string | null = null;
let presenceTimer: ReturnType<typeof setInterval> | null = null;
const subscribedTopics = new Set<string>();
let brokerSniffTimer: ReturnType<typeof setTimeout> | null = null;

/** state_topic → capability ids (usually one) */
const topicIndex = new Map<string, { capabilityId: string; kind: string }[]>();

/**
 * Shelly: `${prefix}\0switch:N` → capability id.
 * Used for events/rpc NotifyStatus and full /status blobs (status_ntf is off by default).
 */
const shellySwitchIndex = new Map<string, string>();
const shellyPrefixes = new Set<string>();

let cachedPrefixes: string[] = [];
/**
 * Topics Nexternel itself sends to (switch commands, status requests). The message service passes
 * them back to Nexternel too: they are its own words, never a sign that a board is there.
 */
const sentTopics = new Set<string>();
function noteSent(topic: string): string {
  sentTopics.add(topic);
  return topic;
}
/** MQTT topic prefix → the device(s) behind it: the device path knows devices, not topics. */
const devicesByPrefix = new Map<string, string[]>();

/** A Shelly is online only when it answers live (shelly/presence-check.ts). */
const shellyPresence = createShellyPresenceCheck({
  ask(prefix) {
    if (!client?.connected) return false;
    try {
      // Gen1 answers "announce" with its online word and info; Gen2 and newer answer "status_update" with their status.
      client.publish(noteSent(`${prefix}/command`), isShellyGen1MqttPrefix(prefix) ? "announce" : "status_update", { qos: 0 });
      return true;
    } catch {
      return false;
    }
  },
  notThere(prefix) {
    devicePath.deviceOffline(devicesOf(prefix));
  },
  connected: () => Boolean(client?.connected),
});
let mqttMessagesReceived = 0;
let mqttCapabilityUpdates = 0;

export function getMqttStatus() {
  return { status, lastError, broker: config.mqttBroker() };
}

export function getMqttClientDiagnostics() {
  return {
    status,
    lastError,
    broker: config.mqttBroker(),
    connected: client?.connected ?? false,
    subscribedTopicCount: subscribedTopics.size,
    subscribedTopics: [...subscribedTopics].sort(),
    indexedStateTopicCount: topicIndex.size,
    indexedStateTopics: [...topicIndex.keys()].sort(),
    devicePrefixCount: cachedPrefixes.length,
    devicePrefixes: [...cachedPrefixes].sort(),
    shellyPrefixCount: shellyPrefixes.size,
    shellyPrefixes: [...shellyPrefixes].sort(),
    shellySwitchBindingCount: shellySwitchIndex.size,
    liveTopicMapSize: getLiveTopicMapSize(),
    messagesReceived: mqttMessagesReceived,
    capabilityUpdates: mqttCapabilityUpdates,
    observationRingSize: getMqttObservationRing().length,
    brokerSniff: getBrokerSniffSamples(),
  };
}

/** Admin-only: subscribe to `#` briefly to sample live broker traffic (read-only). */
export async function startBrokerTopicSniff(durationMs: number): Promise<{
  ok: boolean;
  message: string;
  durationMs: number;
}> {
  if (!client?.connected) {
    return { ok: false, message: "MQTT client is not connected.", durationMs: 0 };
  }
  const ms = Math.min(Math.max(durationMs, 5_000), 120_000);
  startBrokerSniffWindow(ms);
  if (brokerSniffTimer) clearTimeout(brokerSniffTimer);
  client.subscribe("#", { qos: 0 }, (err) => {
    if (err) lastError = err.message;
  });
  brokerSniffTimer = setTimeout(() => {
    client?.unsubscribe("#");
    brokerSniffTimer = null;
  }, ms);
  return {
    ok: true,
    message: `Broker sniff active for ${Math.round(ms / 1000)}s`,
    durationMs: ms,
  };
}

function shellyIndexKey(prefix: string, componentKey: string): string {
  return `${prefix}\0${componentKey.toLowerCase()}`;
}

function longestPrefixForTopic(topic: string): string | null {
  let best: string | null = null;
  for (const p of cachedPrefixes) {
    if (topic === p || topic.startsWith(`${p}/`)) {
      if (!best || p.length > best.length) best = p;
    }
  }
  return best;
}

async function rebuildTopicIndex() {
  topicIndex.clear();
  shellySwitchIndex.clear();
  shellyPrefixes.clear();
  clearLiveTopicMap();

  const bindings = await listStateTopicBindings();
  for (const b of bindings) {
    registerTopicBinding(b.state_topic, b.capability_id, b.kind);
  }

  const entities = await listEsphomeLiveEntities();
  for (const row of entities) {
    registerEsphomeEntityTopics({
      capabilityId: row.capability_id,
      kind: row.kind,
      devicePrefix: row.prefix,
      deviceSlug: row.slug,
      entityId: row.entity_id,
      segment: row.segment,
    });
    if (row.state_topic) {
      registerTopicBinding(row.state_topic, row.capability_id, row.kind);
    }
  }

  setMqttDevices(await listMqttDevices());

  const shelly = await listShellySwitchBindings();
  for (const row of shelly) {
    shellyPrefixes.add(row.mqtt_topic_prefix);
    shellySwitchIndex.set(
      shellyIndexKey(row.mqtt_topic_prefix, row.component_key),
      row.capability_id
    );
  }
}

function setMqttDevices(devices: { id: string; prefix: string }[]) {
  devicesByPrefix.clear();
  for (const d of devices) devicesByPrefix.set(d.prefix, [...(devicesByPrefix.get(d.prefix) ?? []), d.id]);
  cachedPrefixes = [...devicesByPrefix.keys()];
}

function devicesOf(prefix: string): string[] {
  return devicesByPrefix.get(prefix) ?? [];
}

/** Where a reading on this topic is kept in history (Nexternel's own sensor topics only). */
function historyKeyOf(topic: string, kind: string): HistoryKey | null {
  if (kind === "switch") return null;
  const parsed = parseMqttSensorStateTopic(topic);
  return parsed ? { deviceSlug: parsed.deviceSlug, entityId: parsed.entityId } : null;
}

function reportFromTopic(topic: string, capabilityId: string, value: unknown, retained: boolean, kind: string) {
  devicePath.reportItem(capabilityId, value, { kind, retained, history: historyKeyOf(topic, kind) });
}

/** Device presence: explicit MQTT availability + last_seen; Offline derived at read time. */
function applyDeviceRootStatusTopic(topic: string, payload: string): boolean {
  const prefix = longestPrefixForTopic(topic);
  if (!prefix || topic !== `${prefix}/status`) return false;
  const state = payload.trim().toLowerCase();
  if (state === "online" || state === "true" || state === "1") {
    devicePath.deviceOnline(devicesOf(prefix));
    return true;
  }
  if (state === "offline" || state === "false" || state === "0") {
    devicePath.deviceOffline(devicesOf(prefix));
    return true;
  }
  return false;
}

/**
 * Shelly: {prefix}/online → true|false. A live "true" is proof; a replayed one (kept by the message
 * service from before) is only checked, never believed by itself (shelly/presence-check.ts).
 */
function applyDeviceShellyOnlineTopic(topic: string, payload: string, retained: boolean): boolean {
  const match = /^(.+)\/online$/i.exec(topic);
  if (!match) return false;
  const prefix = longestPrefixForTopic(topic);
  if (!prefix || prefix !== match[1]) return false;
  const state = payload.trim().toLowerCase();
  if (/^(true|1|online)$/.test(state)) {
    if (retained && shellyPrefixes.has(prefix)) {
      shellyPresence.check(prefix);
      return true;
    }
    shellyPresence.heardLive(prefix);
    devicePath.deviceOnline(devicesOf(prefix));
    return true;
  }
  if (/^(false|0|offline)$/.test(state)) {
    shellyPresence.saidOffline(prefix);
    devicePath.deviceOffline(devicesOf(prefix));
    return true;
  }
  return false;
}

function touchDeviceOnlineFromTopic(topic: string, retained: boolean) {
  if (retained) return;
  const prefix = longestPrefixForTopic(topic);
  if (!prefix) return;
  shellyPresence.heardLive(prefix);
  devicePath.deviceHeard(devicesOf(prefix));
}

function applyShellyTopicUpdates(
  topic: string,
  payload: string,
  retained: boolean
): boolean {
  const updates = parseShellyMqttSwitchUpdates(topic, payload);
  if (!updates.length) return false;

  const prefix = longestPrefixForTopic(topic);
  if (!prefix || !shellyPrefixes.has(prefix)) return false;

  let applied = false;
  for (const u of updates) {
    const capabilityId = shellySwitchIndex.get(
      shellyIndexKey(prefix, u.componentKey)
    );
    if (!capabilityId) continue;
    devicePath.reportItem(capabilityId, u.output, { kind: "switch", retained });
    applied = true;
  }
  if (applied) {
    // A replayed switch position is only the last thing it said, not proof it is there now.
    if (!retained) devicePath.deviceOnline(devicesOf(prefix));
  }
  return applied;
}

const ESPHOME_SENSOR_STATE_RE = /^(.+)\/sensor\/([^/]+)\/state$/;

function inferSensorMatchFromEntity(entityId: string): {
  sensorType: string;
  nameHint: string | null;
} | null {
  const e = entityId.toLowerCase();
  if (e.includes("pm_10") || e.includes("pm10") || (e.includes("particulate") && e.includes("10"))) {
    return { sensorType: "pm10", nameHint: "10" };
  }
  if (
    e.includes("pm_2") ||
    e.includes("pm25") ||
    e.includes("pm2") ||
    (e.includes("particulate") && e.includes("2.5"))
  ) {
    return { sensorType: "pm25", nameHint: "2.5" };
  }
  if (
    e.includes("pm_1") ||
    (e.includes("particulate") && (e.includes("1.0") || e.includes("1_0")))
  ) {
    return { sensorType: "pm1", nameHint: "1.0" };
  }
  if (e.includes("co2") || e.includes("carbon")) {
    return { sensorType: "co2", nameHint: "co2" };
  }
  if (e.includes("temp")) return { sensorType: "temperature", nameHint: "temp" };
  if (e.includes("humid")) return { sensorType: "humidity", nameHint: "humid" };
  if (e.includes("batt")) return { sensorType: "battery", nameHint: "batt" };
  if (e.includes("power")) return { sensorType: "power", nameHint: "power" };
  if (e.includes("daily")) return { sensorType: "energy", nameHint: "daily" };
  if (e.includes("total") && e.includes("energy")) {
    return { sensorType: "energy", nameHint: "total" };
  }
  if (e.includes("energy")) return { sensorType: "energy", nameHint: null };
  return null;
}

function registerTopicBinding(topic: string, capabilityId: string, kind: string) {
  const list = topicIndex.get(topic) ?? [];
  if (!list.some((e) => e.capabilityId === capabilityId)) {
    list.push({ capabilityId, kind });
    topicIndex.set(topic, list);
  }
  registerLiveTopicBinding(topic, capabilityId, kind);
}

/** Self-heal when DB state_topic lags ESPHome MQTT object_id (common after Glow import fixes). */
async function tryHealEsphomeSensorTopic(
  topic: string,
  payload: string,
  retained: boolean
): Promise<boolean> {
  const m = ESPHOME_SENSOR_STATE_RE.exec(topic);
  if (!m) return false;
  const prefix = m[1]!;
  const entityId = m[2]!;
  const deviceSlug = deviceSlugFromMqttPrefix(prefix);
  const hint = inferSensorMatchFromEntity(entityId);

  let row:
    | {
        capability_id: string;
        kind: string;
        sensor_id: string;
        stored_topic: string;
      }
    | undefined;

  const exact = await getPool().query<{
    capability_id: string;
    kind: string;
    sensor_id: string;
    stored_topic: string;
  }>(
    `SELECT c.id AS capability_id, c.kind, s.id AS sensor_id, s.mqtt_state_topic AS stored_topic
     FROM devices d
     JOIN sensors s ON s.device_id = d.id
     JOIN capabilities c ON c.source_type = 'sensor' AND c.source_id = s.id AND c.is_enabled = TRUE
     WHERE (d.mqtt_topic_prefix = $1 OR ($4::text IS NOT NULL AND d.slug = $4))
       AND (s.esphome_entity_id = $2 OR s.mqtt_state_topic = $3)
     LIMIT 1`,
    [prefix, entityId, topic, deviceSlug]
  );
  row = exact.rows[0];

  if (!row && hint) {
    const fuzzy = await getPool().query<{
      capability_id: string;
      kind: string;
      sensor_id: string;
      stored_topic: string;
    }>(
      `SELECT c.id AS capability_id, c.kind, s.id AS sensor_id, s.mqtt_state_topic AS stored_topic
       FROM devices d
       JOIN sensors s ON s.device_id = d.id
       JOIN capabilities c ON c.source_type = 'sensor' AND c.source_id = s.id AND c.is_enabled = TRUE
       WHERE (d.mqtt_topic_prefix = $1 OR ($4::text IS NOT NULL AND d.slug = $4))
         AND s.sensor_type = $2
         AND ($3::text IS NULL OR LOWER(s.name) LIKE '%' || $3 || '%')
       ORDER BY s.updated_at DESC
       LIMIT 1`,
      [prefix, hint.sensorType, hint.nameHint, deviceSlug]
    );
    row = fuzzy.rows[0];
  }

  if (!row) return false;

  if (row.stored_topic !== topic) {
    await getPool().query(
      `UPDATE devices d
       SET mqtt_topic_prefix = $2, updated_at = NOW()
       FROM sensors s
       WHERE s.id = $1 AND s.device_id = d.id AND d.mqtt_topic_prefix IS DISTINCT FROM $2`,
      [row.sensor_id, prefix]
    );
    await getPool().query(
      `UPDATE sensors
       SET mqtt_state_topic = $2, esphome_entity_id = $3, updated_at = NOW()
       WHERE id = $1`,
      [row.sensor_id, topic, entityId]
    );
    await getPool().query(
      `UPDATE capability_bindings
       SET state_topic = $2, updated_at = NOW()
       WHERE capability_id = $1`,
      [row.capability_id, topic]
    );
  }

  registerTopicBinding(topic, row.capability_id, row.kind);
  reportFromTopic(topic, row.capability_id, parseMqttPayload(row.kind, payload), retained, row.kind);
  return true;
}

const ESPHOME_SWITCH_STATE_RE = /^(.+)\/switch\/([^/]+)\/state$/;

/** Self-heal relay command/state topics when ESPHome object_id differs from YAML id. */
async function tryHealEsphomeSwitchTopic(
  topic: string,
  payload: string,
  retained: boolean
): Promise<boolean> {
  const m = ESPHOME_SWITCH_STATE_RE.exec(topic);
  if (!m) return false;
  const prefix = m[1]!;
  const entityId = m[2]!;
  const commandTopic = `${prefix}/switch/${entityId}/command`;
  const deviceSlug = deviceSlugFromMqttPrefix(prefix);

  const exact = await getPool().query<{
    capability_id: string;
    relay_id: string;
    stored_state: string;
    stored_command: string;
  }>(
    `SELECT c.id AS capability_id, r.id AS relay_id,
            r.mqtt_state_topic AS stored_state, r.mqtt_command_topic AS stored_command
     FROM devices d
     JOIN relays r ON r.device_id = d.id
     JOIN capabilities c ON c.source_type = 'relay' AND c.source_id = r.id AND c.is_enabled = TRUE
     WHERE (d.mqtt_topic_prefix = $1 OR ($4::text IS NOT NULL AND d.slug = $4))
       AND (r.esphome_entity_id = $2 OR r.mqtt_state_topic = $3)
     LIMIT 1`,
    [prefix, entityId, topic, deviceSlug]
  );
  let row = exact.rows[0];

  if (!row) {
    const fuzzy = await getPool().query<{
      capability_id: string;
      relay_id: string;
      stored_state: string;
      stored_command: string;
    }>(
      `SELECT c.id AS capability_id, r.id AS relay_id,
              r.mqtt_state_topic AS stored_state, r.mqtt_command_topic AS stored_command
       FROM devices d
       JOIN relays r ON r.device_id = d.id
       JOIN capabilities c ON c.source_type = 'relay' AND c.source_id = r.id AND c.is_enabled = TRUE
       WHERE (d.mqtt_topic_prefix = $1 OR ($2::text IS NOT NULL AND d.slug = $2))
         AND (LOWER(r.name) LIKE '%measur%' OR LOWER(r.slug) LIKE '%pms%')
       ORDER BY r.updated_at DESC
       LIMIT 1`,
      [prefix, deviceSlug]
    );
    row = fuzzy.rows[0];
  }

  if (!row) return false;

  if (row.stored_state !== topic || row.stored_command !== commandTopic) {
    await getPool().query(
      `UPDATE devices d
       SET mqtt_topic_prefix = $2, updated_at = NOW()
       FROM relays r
       WHERE r.id = $1 AND r.device_id = d.id AND d.mqtt_topic_prefix IS DISTINCT FROM $2`,
      [row.relay_id, prefix]
    );
    await getPool().query(
      `UPDATE relays
       SET mqtt_state_topic = $2, mqtt_command_topic = $3, esphome_entity_id = $4, updated_at = NOW()
       WHERE id = $1`,
      [row.relay_id, topic, commandTopic, entityId]
    );
    await getPool().query(
      `UPDATE capability_bindings
       SET state_topic = $2, command_topic = $3, updated_at = NOW()
       WHERE capability_id = $1`,
      [row.capability_id, topic, commandTopic]
    );
  }

  registerTopicBinding(topic, row.capability_id, "switch");
  reportFromTopic(topic, row.capability_id, parseMqttPayload("switch", payload), retained, "switch");
  return true;
}

function lookupTopicBindings(topic: string): { capabilityId: string; kind: string }[] {
  const fromIndex = topicIndex.get(topic);
  if (fromIndex?.length) return fromIndex;
  return getLiveTopicBindings(topic).map((b) => ({
    capabilityId: b.capabilityId,
    kind: b.kind,
  }));
}

async function handleMessage(
  topic: string,
  payloadBuf: Buffer,
  packet: { retain?: boolean }
) {
  mqttMessagesReceived += 1;
  const payload = payloadBuf.toString("utf8");
  const retained = Boolean(packet.retain);
  let observationKind: MqttObservationKind = "unmatched";
  const observationCapabilityIds: string[] = [];

  const finishObservation = () => {
    recordMqttObservation({
      topic,
      payloadPreview: payload.slice(0, 200),
      retained,
      receivedAt: new Date().toISOString(),
      kind: observationKind,
      capabilityIds: observationCapabilityIds,
    });
  };

  // The message service's own notices (why a device was disconnected).
  if (topic.startsWith("$SYS/broker/log/")) {
    applyBrokerLog(payload);
    return;
  }

  // Nexternel's own message coming back: says nothing about the board.
  if (sentTopics.has(topic)) return;

  const presenceHandled =
    applyDeviceRootStatusTopic(topic, payload) ||
    applyDeviceShellyOnlineTopic(topic, payload, retained);
  if (presenceHandled) {
    observationKind = "device_presence";
    finishObservation();
    return;
  }
  // The board's own health (Wi-Fi signal, time since restart): proof it is there, but not a reading.
  if (applyBoardHealthTopic(topic, payload, retained, longestPrefixForTopic)) {
    touchDeviceOnlineFromTopic(topic, retained);
    observationKind = "device_presence";
    finishObservation();
    return;
  }
  if (!presenceHandled) {
    touchDeviceOnlineFromTopic(topic, retained);
  }

  // Shelly app / physical switch / status_update → events/rpc or /status
  const shellyHandled = applyShellyTopicUpdates(topic, payload, retained);
  if (shellyHandled) {
    observationKind = "shelly_switch";
    const prefix = longestPrefixForTopic(topic);
    if (prefix) {
      const updates = parseShellyMqttSwitchUpdates(topic, payload);
      for (const u of updates) {
        const capId = shellySwitchIndex.get(shellyIndexKey(prefix, u.componentKey));
        if (capId) observationCapabilityIds.push(capId);
      }
    }
  }

  const entries = lookupTopicBindings(topic);
  if (!entries.length) {
    if (shellyHandled) {
      finishObservation();
      return;
    }
    let healed = await tryHealEsphomeSensorTopic(topic, payload, retained);
    if (!healed) {
      healed = await tryHealEsphomeSwitchTopic(topic, payload, retained);
    }
    if (healed) observationKind = "esphome_heal";
    finishObservation();
    return;
  }

  // Avoid double-applying the same Shelly status payload
  if (
    shellyHandled &&
    (/\/status\/switch:\d+$/i.test(topic) || /\/relay\/\d+$/i.test(topic))
  ) {
    finishObservation();
    return;
  }

  observationKind = "capability_binding";
  for (const { capabilityId, kind } of entries) {
    observationCapabilityIds.push(capabilityId);
    reportFromTopic(topic, capabilityId, parseMqttPayload(kind, payload), retained, kind);
    mqttCapabilityUpdates += 1;
  }
  finishObservation();
}

/**
 * Ask each Shelly to publish its full status (fills the cache after an API restart). It is also the
 * presence check: a Shelly that does not answer is offline, whatever was written down before.
 */
function requestShellyStatusUpdates() {
  if (!client?.connected) return;
  let hasGen1 = false;
  for (const prefix of shellyPrefixes) {
    if (isShellyGen1MqttPrefix(prefix)) hasGen1 = true;
    shellyPresence.check(prefix);
  }
  if (hasGen1) {
    try {
      client.publish(noteSent("shellies/command"), "update", { qos: 0 });
    } catch {
      /* ignore */
    }
  }
}

function startPresenceSweeper() {
  if (presenceTimer) return;
  presenceTimer = setInterval(() => void sweepSilentBoards(), 15_000);
  presenceTimer.unref?.();
}

/** A Nexternel board reports every minute (time since restart); this long without a word = gone. */
const BOARD_SILENT_MS = 3 * 60_000;

/**
 * Boards with Nexternel's shared settings report every minute, so a board that has said nothing for
 * three minutes is gone — even when its last word was "online" and the message service has not (yet)
 * passed on its last will. It is marked offline like any drop-out (connection history, bell); its next
 * message brings it back. A board is known to report every minute by its software fingerprint.
 */
async function sweepSilentBoards() {
  try {
    const r = await getPool().query<{ id: string; prefix: string }>(
      `SELECT id, mqtt_topic_prefix AS prefix FROM devices
        WHERE is_enabled AND connection = 'mqtt' AND COALESCE(firmware_type, 'esphome') = 'esphome' AND availability = 'online'
          AND last_seen_at < NOW() - make_interval(secs => $1)`,
      [BOARD_SILENT_MS / 1000]
    );
    for (const { id, prefix } of r.rows) {
      if (!prefix || !boardFingerprint(prefix)) continue;
      devicePath.deviceOffline([id]);
    }
  } catch {
    /* next sweep */
  }
}

export async function startTelemetry(): Promise<void> {
  await rebuildTopicIndex();
  startPresenceSweeper();

  if (client) {
    try {
      client.end(true);
    } catch {
      /* ignore */
    }
    client = null;
  }

  status = "connecting";
  lastError = null;

  const broker = config.mqttBroker();
  const username = config.mqttUsername();
  const password = config.mqttPassword();

  client = mqtt.connect(broker, {
    username: username || undefined,
    password: password || undefined,
    clientId: `nexternel-api-${Date.now()}`,
    reconnectPeriod: 5000,
    // Keep trying after a refused login too (mqtt.js stops for good by default): the login can
    // change underneath, e.g. a restore carries the old server's login over.
    reconnectOnConnackError: true,
  });

  // Each retry uses the login as it is now, not the one this connection started with.
  client.on("reconnect", () => {
    if (!client) return;
    client.options.username = config.mqttUsername() || undefined;
    client.options.password = config.mqttPassword() || undefined;
  });

  client.on("connect", async () => {
    if (status === "disconnected" || status === "error") void logActivity({ kind: "system", text: "Connection to the message service (MQTT) is back" });
    status = "connected";
    lastError = null;
    try {
      await rebuildTopicIndex();
      const topics = collectMqttSubscriptionTopics({
        installationRoot: installationMqttRoot(),
        devicePrefixes: cachedPrefixes,
        bindingStateTopics: [...topicIndex.keys()],
      });
      for (const topic of topics) {
        subscribedTopics.add(topic);
        client?.subscribe(topic, { qos: 0 }, (err) => {
          if (err) lastError = err.message;
        });
      }
      client?.subscribe(BROKER_LOG_TOPIC, { qos: 0 });
      // After subscriptions: pull current Shelly outputs (app/physical may not
      // have published status/switch:N because status_ntf defaults to false).
      requestShellyStatusUpdates();
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      status = "error";
    }
  });

  client.on("message", (topic, payload, packet) => {
    void handleMessage(topic, payload, packet).catch(() => {
      /* ignore handler errors */
    });
  });

  client.on("error", (err) => {
    status = "error";
    lastError = err.message;
  });

  client.on("close", () => {
    if (status === "connected") {
      status = "disconnected";
      void logActivity({ kind: "system", text: "Connection to the message service (MQTT) lost" });
    }
  });
}

export async function refreshTelemetrySubscriptions(): Promise<void> {
  await rebuildTopicIndex();
  if (!client?.connected) return;
  const topics = collectMqttSubscriptionTopics({
    installationRoot: installationMqttRoot(),
    devicePrefixes: cachedPrefixes,
    bindingStateTopics: [...topicIndex.keys()],
  });
  for (const topic of topics) {
    if (subscribedTopics.has(topic)) continue;
    subscribedTopics.add(topic);
    client.subscribe(topic, { qos: 0 });
  }
  requestShellyStatusUpdates();
}

/** Ask a board for a health report now (presses its Health check button over MQTT); false = not connected. */
export function requestHealthReport(prefix: string): boolean {
  if (!client?.connected) return false;
  client.publish(noteSent(`${prefix}/button/health_check/command`), "PRESS", { qos: 0 });
  return true;
}

/** What a board understands as on or off on its command topic. */
function switchPayload(cap: { firmware_type: string | null; command_topic: string | null }, on: boolean): string {
  const shelly = cap.firmware_type === "shelly" || looksLikeShellyCommandTopic(cap.command_topic);
  if (shelly) return on ? "on" : "off";
  return on ? "ON" : "OFF";
}

/** How a switch press goes out over MQTT; the board's report on its state topic confirms it. */
export const mqttItemSender: ItemSender = {
  unavailable: () => (client?.connected ? null : "MQTT not connected"),
  send(item: CapabilityRow, on: boolean) {
    const mqttClient = client;
    if (!mqttClient || !item.command_topic) return Promise.reject(new Error("MQTT not connected"));
    return new Promise<void>((resolve, reject) => {
      mqttClient.publish(noteSent(item.command_topic!), switchPayload(item, on), { qos: 1 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
};

export function stopTelemetry() {
  client?.end(true);
  client = null;
  status = "disconnected";
}
