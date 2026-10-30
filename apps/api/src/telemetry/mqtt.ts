import mqtt, { type MqttClient } from "mqtt";
import { config } from "../config.js";
import {
  listDevicePrefixes,
  listEsphomeLiveEntities,
  listShellySwitchBindings,
  listStateTopicBindings,
  getCapabilityById,
} from "../capabilities/store.js";
import { getLiveState, parseMqttPayload, setLiveState, getAllLiveStates } from "./state-cache.js";
import { LIVE_CAPABILITY_PRESENCE_MS } from "../devices/presence.js";
import { getPool } from "../db.js";
import { applyBoardHealthTopic } from "../devices/board-health.js";
import { looksLikeShellyCommandTopic, isShellyGen1MqttPrefix } from "../shelly/topics.js";
import { parseShellyMqttSwitchUpdates } from "../shelly/notify.js";
import {
  countSwitchesInStatusResult,
  enrichDiscoveredShelly,
  parseShellyAnnouncePayload,
  type DiscoveredShelly,
  type DiscoveredShellyBase,
} from "../shelly/discover.js";
import { guessShellyGen } from "../shelly/models.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import {
  collectMqttSubscriptionTopics,
  deviceSlugFromMqttPrefix,
} from "./mqtt-subscriptions.js";
import { persistMqttSensorHistory } from "../history/mqtt-persist.js";
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

/** Debounce device online touches (prefix → last ms) */
const lastOnlineTouch = new Map<string, number>();
/** Debounce capability-driven presence (capability id → last ms) */
const lastCapabilityOnlineTouch = new Map<string, number>();
let cachedPrefixes: string[] = [];
let mqttMessagesReceived = 0;
let mqttCapabilityUpdates = 0;

/** Phase 3 discovery temporary listeners (announce / RPC probe replies). */
type DiscoveryCollector = (topic: string, payload: string) => void;
const discoveryCollectors = new Set<DiscoveryCollector>();

function notifyDiscoveryCollectors(topic: string, payload: string) {
  for (const fn of discoveryCollectors) {
    try {
      fn(topic, payload);
    } catch {
      /* ignore */
    }
  }
}

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

  cachedPrefixes = await listDevicePrefixes();

  const shelly = await listShellySwitchBindings();
  for (const row of shelly) {
    shellyPrefixes.add(row.mqtt_topic_prefix);
    shellySwitchIndex.set(
      shellyIndexKey(row.mqtt_topic_prefix, row.component_key),
      row.capability_id
    );
  }
}

/** Device presence: explicit MQTT availability + last_seen; Offline derived at read time. */

function markDeviceOnline(prefix: string) {
  void getPool()
    .query(
      `UPDATE devices
       SET mqtt_availability = 'online',
           last_seen_at = NOW()
       WHERE mqtt_topic_prefix = $1`,
      [prefix]
    )
    .catch(() => {
      /* ignore */
    });
  void import("../esphome/lifecycle.js")
    .then((m) => m.syncEsphomeLifecycleForPrefix(prefix, true))
    .catch(() => {
      /* ignore */
    });
}

function markDeviceOffline(prefix: string) {
  void getPool()
    .query(
      `UPDATE devices
       SET mqtt_availability = 'offline'
       WHERE mqtt_topic_prefix = $1`,
      [prefix]
    )
    .catch(() => {
      /* ignore */
    });
  void import("../esphome/lifecycle.js")
    .then((m) => m.syncEsphomeLifecycleForPrefix(prefix, false))
    .catch(() => {
      /* ignore */
    });
}

async function staleCapabilitiesForPrefix(prefix: string) {
  const caps = await getPool().query<{ id: string }>(
    `SELECT c.id FROM capabilities c
     JOIN devices d ON d.id = c.device_id
     WHERE d.mqtt_topic_prefix = $1
       AND COALESCE(d.firmware_type, 'esphome') NOT IN ('octopus', 'plugin')`,
    [prefix]
  );
  for (const row of caps.rows) {
    const s = getLiveState(row.id);
    if (s && s.quality === "good") {
      setLiveState(row.id, s.value, { quality: "stale", retained: s.retained });
    }
  }
}

function applyDeviceRootStatusTopic(
  topic: string,
  payload: string,
  retained: boolean
): boolean {
  const prefix = longestPrefixForTopic(topic);
  if (!prefix || topic !== `${prefix}/status`) return false;
  const state = payload.trim().toLowerCase();
  if (state === "online" || state === "true" || state === "1") {
    markDeviceOnline(prefix);
    return true;
  }
  if (state === "offline" || state === "false" || state === "0") {
    markDeviceOffline(prefix);
    void staleCapabilitiesForPrefix(prefix);
    return true;
  }
  return false;
}

/** Shelly Gen1: {prefix}/online → true|false */
function applyDeviceShellyOnlineTopic(
  topic: string,
  payload: string,
  retained: boolean
): boolean {
  const match = /^(.+)\/online$/i.exec(topic);
  if (!match) return false;
  const prefix = longestPrefixForTopic(topic);
  if (!prefix || prefix !== match[1]) return false;
  const state = payload.trim().toLowerCase();
  if (/^(true|1|online)$/.test(state)) {
    markDeviceOnline(prefix);
    return true;
  }
  if (/^(false|0|offline)$/.test(state)) {
    markDeviceOffline(prefix);
    void staleCapabilitiesForPrefix(prefix);
    return true;
  }
  return false;
}

function touchDeviceOnlineByCapability(capabilityId: string) {
  const now = Date.now();
  const prev = lastCapabilityOnlineTouch.get(capabilityId) ?? 0;
  if (now - prev < 15_000) return;
  lastCapabilityOnlineTouch.set(capabilityId, now);
  void getPool()
    .query(
      `UPDATE devices d
       SET mqtt_availability = 'online',
           last_seen_at = NOW()
       FROM capabilities c
       WHERE c.id = $1 AND c.device_id = d.id`,
      [capabilityId]
    )
    .catch(() => {
      /* ignore */
    });
}

function touchDeviceOnlineFromTopic(topic: string, retained: boolean) {
  if (retained) return;
  const prefix = longestPrefixForTopic(topic);
  if (!prefix) return;
  const now = Date.now();
  const prev = lastOnlineTouch.get(prefix) ?? 0;
  if (now - prev < 15_000) return;
  lastOnlineTouch.set(prefix, now);
  markDeviceOnline(prefix);
}

function applyLiveCapability(
  capabilityId: string,
  value: unknown,
  retained: boolean,
  kind = "switch"
) {
  const sensorLike = kind !== "switch";
  if (!retained || kind === "switch") {
    touchDeviceOnlineByCapability(capabilityId);
  }
  setLiveState(capabilityId, value, {
    quality: retained && sensorLike ? "stale" : "good",
    retained,
  });
  if (kind === "switch" && typeof value === "boolean") {
    void getPool()
      .query(
        `UPDATE relays r
         SET last_state = $1, updated_at = NOW()
         FROM capabilities c
         WHERE c.id = $2
           AND c.source_type = 'relay'
           AND r.id = c.source_id`,
        [value ? "ON" : "OFF", capabilityId]
      )
      .catch(() => {
        /* ignore */
      });
  }
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
    applyLiveCapability(capabilityId, u.output, retained, "switch");
    applied = true;
  }
  if (applied) {
    markDeviceOnline(prefix);
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
  const value = parseMqttPayload(row.kind, payload);
  applyLiveCapability(row.capability_id, value, retained, row.kind);
  if (row.kind !== "switch" && !retained) {
    persistMqttSensorHistory(topic, value);
  }
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
  const value = parseMqttPayload("switch", payload);
  applyLiveCapability(row.capability_id, value, retained, "switch");
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

  notifyDiscoveryCollectors(topic, payload);

  const presenceHandled =
    applyDeviceRootStatusTopic(topic, payload, retained) ||
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
    const value = parseMqttPayload(kind, payload);
    applyLiveCapability(capabilityId, value, retained, kind);
    if (kind !== "switch" && !retained) {
      persistMqttSensorHistory(topic, value);
    }
    mqttCapabilityUpdates += 1;
  }
  finishObservation();
}

/** Ask each Shelly to publish full status (fills cache after API restart). */
function requestShellyStatusUpdates() {
  if (!client?.connected) return;
  let hasGen1 = false;
  for (const prefix of shellyPrefixes) {
    if (isShellyGen1MqttPrefix(prefix)) {
      hasGen1 = true;
      continue;
    }
    try {
      client.publish(`${prefix}/command`, "status_update", { qos: 0 });
    } catch {
      /* ignore */
    }
  }
  if (hasGen1) {
    try {
      client.publish("shellies/command", "update", { qos: 0 });
    } catch {
      /* ignore */
    }
  }
}

function startPresenceSweeper() {
  if (presenceTimer) return;
  presenceTimer = setInterval(() => {
    void sweepLiveCapabilityFreshness();
  }, 15_000);
  presenceTimer.unref?.();
}

/** Mark in-memory live values stale when they age out — device Offline is derived at read time. */
async function sweepLiveCapabilityFreshness() {
  const staleMs = LIVE_CAPABILITY_PRESENCE_MS;
  const octopusCapIds = await getOctopusCapabilityIdsForPresence();
  for (const state of getAllLiveStates()) {
    if (state.quality !== "good") continue;
    if (octopusCapIds.has(state.capabilityId)) continue;
    const age = Date.now() - Date.parse(state.updatedAt);
    if (age > staleMs) {
      setLiveState(state.capabilityId, state.value, {
        quality: "stale",
        retained: state.retained,
      });
    }
  }
}

let octopusCapIdsCache: Set<string> | null = null;
let octopusCapIdsCacheAt = 0;

async function getOctopusCapabilityIdsForPresence(): Promise<Set<string>> {
  const now = Date.now();
  if (octopusCapIdsCache && now - octopusCapIdsCacheAt < 60_000) {
    return octopusCapIdsCache;
  }
  try {
    const result = await getPool().query<{ id: string }>(
      `SELECT c.id FROM capabilities c
       JOIN devices d ON d.id = c.device_id
       WHERE d.slug = 'octopus-home-mini'`
    );
    octopusCapIdsCache = new Set(result.rows.map((r) => r.id));
    octopusCapIdsCacheAt = now;
    return octopusCapIdsCache;
  } catch {
    return octopusCapIdsCache ?? new Set();
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
  });

  client.on("connect", async () => {
    status = "connected";
    lastError = null;
    try {
      await rebuildTopicIndex();
      const prefixes = await listDevicePrefixes();
      cachedPrefixes = prefixes;
      const topics = collectMqttSubscriptionTopics({
        installationRoot: installationMqttRoot(),
        devicePrefixes: prefixes,
        bindingStateTopics: [...topicIndex.keys()],
      });
      for (const topic of topics) {
        subscribedTopics.add(topic);
        client?.subscribe(topic, { qos: 0 }, (err) => {
          if (err) lastError = err.message;
        });
      }
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
    if (status === "connected") status = "disconnected";
  });
}

export async function refreshTelemetrySubscriptions(): Promise<void> {
  await rebuildTopicIndex();
  if (!client?.connected) return;
  const prefixes = await listDevicePrefixes();
  cachedPrefixes = prefixes;
  const topics = collectMqttSubscriptionTopics({
    installationRoot: installationMqttRoot(),
    devicePrefixes: prefixes,
    bindingStateTopics: [...topicIndex.keys()],
  });
  for (const topic of topics) {
    if (subscribedTopics.has(topic)) continue;
    subscribedTopics.add(topic);
    client.subscribe(topic, { qos: 0 });
  }
  requestShellyStatusUpdates();
}

export async function publishSwitchCommand(
  capabilityId: string,
  action: "on" | "off" | "toggle"
): Promise<{ value: boolean }> {
  const cap = await getCapabilityById(capabilityId);
  if (!cap) throw new Error("Capability not found");
  if (cap.kind !== "switch") throw new Error("Capability is not a switch");
  if (!cap.command_topic) throw new Error("No command topic for this capability");

  let next: boolean;
  if (action === "toggle") {
    const current = getLiveState(capabilityId);
    next = current?.value !== true;
  } else {
    next = action === "on";
  }

  if (cap.firmware_type === "plugin") {
    const { sendPluginSwitchCommand } = await import("../plugins/devices.js");
    await sendPluginSwitchCommand(capabilityId, next);
    // Optimistic; the plugin confirms by sending the switch's new state.
    applyLiveCapability(capabilityId, next, false, "switch");
    return { value: next };
  }

  const shelly =
    cap.firmware_type === "shelly" ||
    looksLikeShellyCommandTopic(cap.command_topic);
  const payload = shelly
    ? next
      ? "on"
      : "off"
    : next
      ? "ON"
      : "OFF";
  const mqttClient = client;
  if (!mqttClient?.connected) {
    throw new Error("MQTT not connected");
  }

  await new Promise<void>((resolve, reject) => {
    mqttClient.publish(cap.command_topic!, payload, { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Optimistic update; state topic / events/rpc will confirm
  applyLiveCapability(capabilityId, next, false, "switch");
  void getPool()
    .query(
      `UPDATE devices
       SET mqtt_availability = 'online',
           last_seen_at = NOW()
       WHERE id = $1`,
      [cap.device_id]
    )
    .catch(() => {
      /* ignore */
    });

  return { value: next };
}

export function stopTelemetry() {
  client?.end(true);
  client = null;
  status = "disconnected";
}

const DISCOVER_SRC = "nexternel/discover";

/**
 * Phase 3: MQTT announce discovery (no LAN RPC/WebSocket driver).
 * Publishes `announce` on shellies/command, collects announce payloads,
 * then optionally probes Shelly.GetStatus over MQTT RPC for switch count.
 */
export async function discoverShellyDevices(opts?: {
  timeoutMs?: number;
}): Promise<{ devices: DiscoveredShelly[]; mqttConnected: boolean }> {
  const mqttClient = client;
  if (!mqttClient?.connected) {
    return { devices: [], mqttConnected: false };
  }

  const timeoutMs = Math.min(15_000, Math.max(2_000, opts?.timeoutMs ?? 5_000));
  const found = new Map<string, DiscoveredShellyBase>();

  const collector: DiscoveryCollector = (topic, payload) => {
    if (
      topic === "shellies/announce" ||
      topic.endsWith("/announce") ||
      /\/announce$/i.test(topic)
    ) {
      const parsed = parseShellyAnnouncePayload(payload);
      if (parsed) found.set(parsed.topicPrefix, parsed);
      return;
    }
    // Online presence: shellyxxx/online (Gen2+) or shellies/shelly1-xxx/online (Gen1)
    const gen1Online = /^shellies\/([^/]+)\/online$/i.exec(topic);
    if (gen1Online && /^(true|1|online)$/i.test(payload.trim())) {
      const deviceId = gen1Online[1]!;
      if (!found.has(deviceId)) {
        found.set(deviceId, {
          topicPrefix: deviceId,
          model: null,
          app: null,
          mac: null,
          gen: 1,
          version: null,
          ip: null,
        });
      }
      return;
    }
    const onlineMatch = /^([^/]+)\/online$/i.exec(topic);
    if (onlineMatch && /^(true|1|online)$/i.test(payload.trim())) {
      const prefix = onlineMatch[1]!;
      if (!found.has(prefix) && /^shelly/i.test(prefix)) {
        found.set(prefix, {
          topicPrefix: prefix,
          model: null,
          app: null,
          mac: null,
          gen: null,
          version: null,
          ip: null,
        });
      }
    }
  };

  discoveryCollectors.add(collector);
  try {
    await new Promise<void>((resolve) => {
      mqttClient.subscribe(
        ["shellies/announce", "shellies/#", "+/announce", `${DISCOVER_SRC}/rpc`],
        { qos: 0 },
        () => resolve()
      );
    });

    await new Promise<void>((resolve, reject) => {
      mqttClient.publish("shellies/command", "announce", { qos: 0 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await new Promise((r) => setTimeout(r, timeoutMs));

    // Probe switch counts in parallel via MQTT RPC GetStatus.
    const devices: DiscoveredShelly[] = await Promise.all(
      [...found.values()].map(async (base) => {
        const suggestedGen = guessShellyGen({
          gen: base.gen,
          model: base.model,
          app: base.app,
          topicPrefix: base.topicPrefix,
        });
        if (suggestedGen === 1) {
          return enrichDiscoveredShelly(base, { suggestedGen: 1 });
        }
        const probed = await probeShellySwitchCountMqtt(base.topicPrefix, 2_000);
        if (probed != null) {
          return enrichDiscoveredShelly(base, {
            switchCount: probed,
            probed: true,
            suggestedGen: 2,
          });
        }
        return enrichDiscoveredShelly(base, { suggestedGen: 2 });
      })
    );

    devices.sort((a, b) => a.topicPrefix.localeCompare(b.topicPrefix));
    return { devices, mqttConnected: true };
  } finally {
    discoveryCollectors.delete(collector);
  }
}

function probeShellySwitchCountMqtt(
  topicPrefix: string,
  waitMs: number
): Promise<number | null> {
  const mqttClient = client;
  if (!mqttClient?.connected) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (n: number | null) => {
      if (settled) return;
      settled = true;
      discoveryCollectors.delete(onRpc);
      resolve(n);
    };

    const onRpc: DiscoveryCollector = (topic, payload) => {
      if (topic !== `${DISCOVER_SRC}/rpc`) return;
      try {
        const msg = JSON.parse(payload) as {
          result?: unknown;
          src?: string;
        };
        // Only accept replies from the device we probed.
        if (msg.src && msg.src !== topicPrefix) return;
        const n = countSwitchesInStatusResult(msg.result);
        if (n != null) finish(n);
      } catch {
        /* ignore */
      }
    };

    discoveryCollectors.add(onRpc);
    const body = JSON.stringify({
      id: 1,
      src: DISCOVER_SRC,
      method: "Shelly.GetStatus",
    });
    mqttClient.publish(`${topicPrefix}/rpc`, body, { qos: 0 }, () => {
      /* fire and forget */
    });
    setTimeout(() => finish(null), waitMs);
  });
}
