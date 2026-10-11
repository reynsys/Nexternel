import type { EsphomeImportSuggestion } from "../../esphome/yaml.js";
import { kindFromSensorType } from "../../capabilities/kinds.js";
import type { CapabilityCandidate, DriverManifest } from "../types.js";

/**
 * ESPHome YAML driver — maps import suggestion to V4 capability candidates.
 * MQTT ingest still uses capability_bindings.state_topic (Phase 2).
 */
export function buildEsphomeDriverManifest(
  suggestion: EsphomeImportSuggestion
): DriverManifest {
  const mqttTopicPrefix = suggestion.mqttTopicPrefix;
  const candidates: CapabilityCandidate[] = [];

  for (const s of suggestion.sensors) {
    candidates.push({
      kind: kindFromSensorType(s.sensorType),
      name: s.name,
      unit: s.unit ?? null,
      sourceType: "sensor",
      sourceSlug: s.slug,
      stateTopic: `${mqttTopicPrefix}/sensor/${s.esphomeEntityId}/state`,
      esphomeEntityId: s.esphomeEntityId,
    });
  }

  for (const r of suggestion.relays) {
    candidates.push({
      kind: "switch",
      name: r.name,
      sourceType: "relay",
      sourceSlug: r.slug,
      stateTopic: `${mqttTopicPrefix}/switch/${r.esphomeEntityId}/state`,
      commandTopic: `${mqttTopicPrefix}/switch/${r.esphomeEntityId}/command`,
      esphomeEntityId: r.esphomeEntityId,
    });
  }

  return {
    driverId: "esphome",
    deviceName: suggestion.esphomeName,
    mqttTopicPrefix,
    esphomeName: suggestion.esphomeName,
    yamlFile: suggestion.yamlFile,
    candidates,
  };
}
