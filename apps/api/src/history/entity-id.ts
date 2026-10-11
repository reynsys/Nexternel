import { parseMqttSensorStateTopic } from "./mqtt-persist.js";

/** Hyphen slug such as hallway-monitor-co2. ESPHome ids also use underscores. */
function isHyphenSlug(entityId: string): boolean {
  return entityId.includes("-") && !entityId.includes("_");
}

/**
 * Resolve the Influx `entity_id` tag for a sensor row.
 * MQTT topic segment is authoritative — history writes use it for the tag.
 */
export function resolveSensorEntityIdForHistory(sensor: {
  slug: string;
  esphome_entity_id: string | null;
  mqtt_state_topic: string | null;
}): string {
  const fromTopic = sensor.mqtt_state_topic
    ? parseMqttSensorStateTopic(sensor.mqtt_state_topic)?.entityId
    : null;
  if (fromTopic) {
    // A topic built from a hyphen slug (hallway-monitor-co2) is not the ESPHome id.
    // A real ESPHome id can contain both, as in house_-_power_consumption.
    if (isHyphenSlug(fromTopic)) {
      const fromSlug = sensor.slug.trim().replace(/-/g, "_");
      if (fromSlug) return fromSlug;
    }
    return fromTopic;
  }

  const explicit = sensor.esphome_entity_id?.trim();
  if (explicit) {
    if (isHyphenSlug(explicit)) {
      const fromSlug = sensor.slug.trim().replace(/-/g, "_");
      if (fromSlug) return fromSlug;
    }
    return explicit;
  }

  return sensor.slug.trim().replace(/-/g, "_");
}
