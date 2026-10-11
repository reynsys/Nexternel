import type { DeviceDetail } from "../devices/service.js";
import { listDevicesDetailed } from "../devices/service.js";
import { listCapabilities } from "../capabilities/store.js";
import { isShellyGen1MqttPrefix } from "../shelly/topics.js";
import { getLiveState } from "../telemetry/state-cache.js";
import {
  getMqttClientDiagnostics,
} from "../telemetry/mqtt.js";
import {
  getMessagesForTopicPrefix,
  getMqttObservationRing,
} from "../telemetry/mqtt-observer.js";

export type PipelineStageStatus = "pass" | "fail" | "unknown" | "warn";

export type PipelineStage = {
  id: string;
  label: string;
  status: PipelineStageStatus;
  detail: string;
};

export type CapabilityDiagnostic = {
  id: string | null;
  name: string;
  kind: string;
  sourceType: "sensor" | "relay";
  expectedStateTopic: string;
  expectedCommandTopic: string | null;
  bindingStateTopic: string | null;
  bindingCommandTopic: string | null;
  telemetryValue: unknown;
  telemetryQuality: string | null;
  telemetryUpdatedAt: string | null;
  stages: PipelineStage[];
};

export type DevicePipelineDiagnostic = {
  deviceId: string;
  name: string;
  driver: string;
  protocol: "shelly-gen1" | "shelly-gen3" | "esphome" | "other";
  area: string | null;
  mqttTopicPrefix: string;
  ipAddress: string | null;
  isOnline: boolean;
  connectivityState: "online" | "no_recent_data" | "offline";
  lastSeenAt: string | null;
  subscriptionTopic: string;
  apiSubscribed: boolean;
  messagesObserved: number;
  lastObservedMessage: {
    topic: string;
    at: string;
    kind: string;
    payloadPreview: string;
  } | null;
  capabilities: CapabilityDiagnostic[];
  pipeline: PipelineStage[];
  breakAt: string | null;
  summary: string;
};

function stage(
  id: string,
  label: string,
  status: PipelineStageStatus,
  detail: string
): PipelineStage {
  return { id, label, status, detail };
}

function resolveProtocol(device: DeviceDetail): DevicePipelineDiagnostic["protocol"] {
  if (device.firmwareType === "esphome") return "esphome";
  if (device.firmwareType === "shelly") {
    return isShellyGen1MqttPrefix(device.mqttTopicPrefix) ? "shelly-gen1" : "shelly-gen3";
  }
  return "other";
}

function buildCapabilityStages(
  cap: CapabilityDiagnostic,
  device: DeviceDetail,
  mqttConnected: boolean,
  prefixSubscribed: boolean,
  hasPrefixTraffic: boolean
): PipelineStage[] {
  const stages: PipelineStage[] = [];
  stages.push(
    stage(
      "binding",
      "Capability binding",
      cap.id ? "pass" : "fail",
      cap.id ? "Capability exists" : "No capability row for this sensor/relay"
    )
  );

  const topicAligned =
    !cap.expectedStateTopic ||
    cap.bindingStateTopic === cap.expectedStateTopic;
  stages.push(
    stage(
      "expected_topic",
      "Expected state topic",
      cap.expectedStateTopic
        ? topicAligned
          ? "pass"
          : "fail"
        : "warn",
      cap.expectedStateTopic
        ? `Relay/sensor: ${cap.expectedStateTopic}; binding: ${cap.bindingStateTopic ?? "—"}`
        : "No state topic on sensor/relay row"
    )
  );

  stages.push(
    stage(
      "mqtt_client",
      "API MQTT client",
      mqttConnected ? "pass" : "fail",
      mqttConnected ? "Connected" : "Not connected"
    )
  );

  stages.push(
    stage(
      "mqtt_subscription",
      "API subscription",
      prefixSubscribed ? "pass" : "fail",
      prefixSubscribed
        ? `Subscribed to ${device.mqttTopicPrefix}/#`
        : `Missing subscription for ${device.mqttTopicPrefix}/#`
    )
  );

  const deviceReachable = device.connectivityState !== "offline";

  stages.push(
    stage(
      "device_publish",
      "Device publishing",
      hasPrefixTraffic ? "pass" : deviceReachable ? "warn" : "fail",
      hasPrefixTraffic
        ? "Messages observed on this prefix since API start"
        : deviceReachable
          ? "No messages in observation ring since API start (device may be idle)"
          : "No MQTT messages observed on this prefix"
    )
  );

  stages.push(
    stage(
      "telemetry_cache",
      "Telemetry cache",
      cap.telemetryQuality === "good"
        ? "pass"
        : cap.telemetryUpdatedAt
          ? "warn"
          : "fail",
      cap.telemetryUpdatedAt
        ? `quality=${cap.telemetryQuality ?? "unknown"} value=${String(cap.telemetryValue)} @ ${cap.telemetryUpdatedAt}`
        : "No live state in API memory for this capability"
    )
  );

  return stages;
}

function deriveBreakAt(pipeline: PipelineStage[]): string | null {
  const order = [
    "mqtt_client",
    "mqtt_subscription",
    "device_publish",
    "binding",
    "expected_topic",
    "telemetry_cache",
  ];
  for (const id of order) {
    const s = pipeline.find((p) => p.id === id);
    if (s?.status === "fail") return id;
  }
  for (const id of order) {
    const s = pipeline.find((p) => p.id === id);
    if (s?.status === "warn") return id;
  }
  return null;
}

export function diagnoseDevice(
  device: DeviceDetail,
  mqttDiag: ReturnType<typeof getMqttClientDiagnostics>,
  bindingByCapId: Map<string, { stateTopic: string | null; commandTopic: string | null }>
): DevicePipelineDiagnostic {
  const protocol = resolveProtocol(device);
  const subscriptionTopic = `${device.mqttTopicPrefix}/#`;
  const apiSubscribed = mqttDiag.subscribedTopics.includes(subscriptionTopic);
  const prefixMessages = getMessagesForTopicPrefix(device.mqttTopicPrefix);
  const lastMsg = prefixMessages[prefixMessages.length - 1];
  const mqttConnected = mqttDiag.connected;

  const capabilities: CapabilityDiagnostic[] = [];

  for (const s of device.sensors) {
    const binding = s.capabilityId ? bindingByCapId.get(s.capabilityId) : undefined;
    const live = s.capabilityId ? getLiveState(s.capabilityId) : null;
    const cap: CapabilityDiagnostic = {
      id: s.capabilityId,
      name: s.name,
      kind: "sensor",
      sourceType: "sensor",
      expectedStateTopic: s.mqttStateTopic,
      expectedCommandTopic: null,
      bindingStateTopic: binding?.stateTopic ?? null,
      bindingCommandTopic: binding?.commandTopic ?? null,
      telemetryValue: live?.value ?? null,
      telemetryQuality: live?.quality ?? null,
      telemetryUpdatedAt: live?.updatedAt ?? null,
      stages: [],
    };
    cap.stages = buildCapabilityStages(
      cap,
      device,
      mqttConnected,
      apiSubscribed,
      prefixMessages.length > 0
    );
    capabilities.push(cap);
  }

  for (const r of device.relays) {
    const binding = r.capabilityId ? bindingByCapId.get(r.capabilityId) : undefined;
    const live = r.capabilityId ? getLiveState(r.capabilityId) : null;
    const cap: CapabilityDiagnostic = {
      id: r.capabilityId,
      name: r.name,
      kind: "switch",
      sourceType: "relay",
      expectedStateTopic: r.mqttStateTopic,
      expectedCommandTopic: r.mqttCommandTopic,
      bindingStateTopic: binding?.stateTopic ?? null,
      bindingCommandTopic: binding?.commandTopic ?? null,
      telemetryValue: live?.value ?? null,
      telemetryQuality: live?.quality ?? null,
      telemetryUpdatedAt: live?.updatedAt ?? null,
      stages: [],
    };
    cap.stages = buildCapabilityStages(
      cap,
      device,
      mqttConnected,
      apiSubscribed,
      prefixMessages.length > 0
    );
    capabilities.push(cap);
  }

  const pipeline: PipelineStage[] = [
    stage(
      "mqtt_client",
      "API MQTT client",
      mqttConnected ? "pass" : "fail",
      mqttConnected ? "Connected" : "Not connected"
    ),
    stage(
      "mqtt_subscription",
      "API subscription",
      apiSubscribed ? "pass" : "fail",
      apiSubscribed
        ? `Subscribed to ${subscriptionTopic}`
        : `Not subscribed to ${subscriptionTopic}`
    ),
    stage(
      "device_publish",
      "Device publishing",
      prefixMessages.length > 0
        ? "pass"
        : device.connectivityState !== "offline"
          ? "warn"
          : "fail",
      prefixMessages.length > 0
        ? `${prefixMessages.length} message(s) observed since API start`
        : device.connectivityState !== "offline"
          ? "No messages since API start (device may be idle)"
          : "No messages observed on this device prefix"
    ),
    stage(
      "capabilities",
      "Capabilities",
      capabilities.length === 0
        ? "warn"
        : capabilities.every((c) => c.id)
          ? "pass"
          : "fail",
      capabilities.length
        ? `${capabilities.filter((c) => c.id).length}/${capabilities.length} mapped to capabilities`
        : "No sensors or relays on device row"
    ),
    stage(
      "telemetry_cache",
      "Telemetry cache",
      capabilities.some((c) => c.telemetryQuality === "good")
        ? "pass"
        : capabilities.some((c) => c.telemetryUpdatedAt)
          ? "warn"
          : "fail",
      capabilities.some((c) => c.telemetryQuality === "good")
        ? "At least one capability has fresh live state"
        : "No fresh live state for any capability on this device"
    ),
  ];

  const breakAt = deriveBreakAt(pipeline);
  let summary = "Pipeline looks healthy for observed traffic.";
  if (breakAt === "mqtt_client") summary = "API MQTT client is not connected.";
  else if (breakAt === "mqtt_subscription")
    summary = "API is not subscribed to this device's MQTT prefix.";
  else if (breakAt === "device_publish")
    summary =
      "No MQTT traffic observed for this device — check physical device, network, broker credentials, or topic prefix.";
  else if (breakAt === "binding" || breakAt === "expected_topic")
    summary = "Database binding or topic mismatch — capability layer does not match relay/sensor topics.";
  else if (breakAt === "telemetry_cache")
    summary =
      "MQTT traffic may be arriving but telemetry state is not updating — investigate message handler / topic match.";

  return {
    deviceId: device.id,
    name: device.name,
    driver: device.firmwareType,
    protocol,
    area: device.roomName,
    mqttTopicPrefix: device.mqttTopicPrefix,
    ipAddress: device.ipAddress,
    isOnline: device.isOnline,
    connectivityState: device.connectivityState,
    lastSeenAt: device.lastSeenAt,
    subscriptionTopic,
    apiSubscribed,
    messagesObserved: prefixMessages.length,
    lastObservedMessage: lastMsg
      ? {
          topic: lastMsg.topic,
          at: lastMsg.receivedAt,
          kind: lastMsg.kind,
          payloadPreview: lastMsg.payloadPreview,
        }
      : null,
    capabilities,
    pipeline,
    breakAt,
    summary,
  };
}

export async function buildLivePipelineDiagnostics(opts?: {
  deviceIds?: string[];
  protocols?: Array<DevicePipelineDiagnostic["protocol"]>;
}) {
  const devices = await listDevicesDetailed();
  const caps = await listCapabilities();
  const bindingByCapId = new Map(
    caps.map((c) => [
      c.id,
      { stateTopic: c.state_topic, commandTopic: c.command_topic },
    ])
  );
  const mqttDiag = getMqttClientDiagnostics();

  let selected = devices.filter((d) => d.isEnabled);
  if (opts?.deviceIds?.length) {
    const ids = new Set(opts.deviceIds);
    selected = selected.filter((d) => ids.has(d.id));
  }

  const records = selected.map((d) => diagnoseDevice(d, mqttDiag, bindingByCapId));
  const filtered = opts?.protocols?.length
    ? records.filter((r) => opts.protocols!.includes(r.protocol))
    : records;

  const byProtocol = {
    shellyGen1: records.filter((r) => r.protocol === "shelly-gen1"),
    shellyGen3: records.filter((r) => r.protocol === "shelly-gen3"),
    esphome: records.filter((r) => r.protocol === "esphome"),
    other: records.filter((r) => r.protocol === "other"),
  };

  const unmatchedRecent = getRecentUnmatchedTopics();

  return {
    measuredAt: new Date().toISOString(),
    mqtt: mqttDiag,
    summary: {
      devicesTotal: records.length,
      devicesWithTraffic: records.filter((r) => r.messagesObserved > 0).length,
      devicesWithoutTraffic: records.filter((r) => r.messagesObserved === 0).length,
      devicesBrokenAtPublish: records.filter((r) => r.breakAt === "device_publish").length,
      devicesBrokenAtSubscription: records.filter(
        (r) => r.breakAt === "mqtt_subscription"
      ).length,
      devicesBrokenAtTelemetry: records.filter((r) => r.breakAt === "telemetry_cache")
        .length,
      observationRingSize: mqttDiag.observationRingSize,
      unmatchedMessageCount: unmatchedRecent.length,
    },
    byProtocol: {
      shellyGen1: summarizeProtocol(byProtocol.shellyGen1),
      shellyGen3: summarizeProtocol(byProtocol.shellyGen3),
      esphome: summarizeProtocol(byProtocol.esphome),
    },
    devices: filtered,
    recentUnmatchedTopics: unmatchedRecent,
  };
}

function summarizeProtocol(devices: DevicePipelineDiagnostic[]) {
  return {
    count: devices.length,
    withTraffic: devices.filter((d) => d.messagesObserved > 0).length,
    withoutTraffic: devices.filter((d) => d.messagesObserved === 0).length,
    breakCounts: countBreaks(devices),
  };
}

function countBreaks(devices: DevicePipelineDiagnostic[]) {
  const out: Record<string, number> = {};
  for (const d of devices) {
    if (!d.breakAt) continue;
    out[d.breakAt] = (out[d.breakAt] ?? 0) + 1;
  }
  return out;
}

function getRecentUnmatchedTopics(limit = 30): {
  topic: string;
  at: string;
  payloadPreview: string;
}[] {
  return getMqttObservationRing(200)
    .filter((m) => m.kind === "unmatched")
    .slice(-limit)
    .map((m) => ({
      topic: m.topic,
      at: m.receivedAt,
      payloadPreview: m.payloadPreview,
    }));
}

export async function buildCommandPathDiagnostic(capabilityId: string) {
  const { getCapabilityById } = await import("../capabilities/store.js");
  const cap = await getCapabilityById(capabilityId);
  if (!cap) {
    return { ok: false, error: "Capability not found" };
  }
  const mqtt = getMqttClientDiagnostics();
  const live = getLiveState(capabilityId);
  return {
    ok: true,
    capabilityId,
    name: cap.name,
    kind: cap.kind,
    deviceName: cap.device_name,
    firmwareType: cap.firmware_type,
    commandTopic: cap.command_topic,
    stateTopic: cap.state_topic,
    mqttConnected: mqtt.connected,
    wouldPublishPayload:
      cap.kind === "switch"
        ? cap.firmware_type === "shelly" || (cap.command_topic?.includes("/command/") ?? false)
          ? "on/off (Shelly)"
          : "ON/OFF (ESPHome)"
        : null,
    liveState: live,
    stages: [
      stage(
        "mqtt_client",
        "API MQTT client",
        mqtt.connected ? "pass" : "fail",
        mqtt.connected ? "Connected" : "Not connected"
      ),
      stage(
        "command_topic",
        "Command topic",
        cap.command_topic ? "pass" : "fail",
        cap.command_topic ?? "No command topic on capability binding"
      ),
      stage(
        "telemetry_state",
        "Current telemetry",
        live?.quality === "good" ? "pass" : live ? "warn" : "fail",
        live
          ? `quality=${live.quality} value=${String(live.value)}`
          : "No live state in cache"
      ),
    ],
    note: "Dry-run only — no command was sent. Use the Live page or dashboard switch to test the full command path.",
  };
}
