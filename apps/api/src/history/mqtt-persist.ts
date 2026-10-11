import { config } from "../config.js";
import { installationMqttRoot } from "../migrate/align-mqtt-topics.js";
import { writeSensorReading } from "./influx.js";

export function parseMqttSensorStateTopic(
  topic: string
): { deviceSlug: string; entityId: string } | null {
  const parts = topic.split("/");
  const root = installationMqttRoot();
  if (
    parts.length < 5 ||
    parts[0] !== root ||
    parts[2] !== "sensor" ||
    parts[4] !== "state"
  ) {
    return null;
  }
  const deviceSlug = parts[1]?.trim();
  const entityId = parts[3]?.trim();
  if (!deviceSlug || !entityId) return null;
  return { deviceSlug, entityId };
}

/** Build Influx line protocol for a sensor reading (`sensor_reading` measurement). */
export function formatSensorReadingLine(input: {
  deviceSlug: string;
  entityId: string;
  value: number;
  entityType?: string;
  timestampMs?: number;
}): string {
  const entityType = input.entityType ?? "sensor";
  const ts = input.timestampMs ?? Date.now();
  return `sensor_reading,device=${input.deviceSlug},entity_type=${entityType},entity_id=${input.entityId} value=${input.value} ${ts}`;
}

/** Store ESPHome sensor MQTT readings in InfluxDB — the API is the only history writer. */
export function persistMqttSensorHistory(topic: string, value: unknown): void {
  const parsed = parseMqttSensorStateTopic(topic);
  if (!parsed) return;
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(num)) return;

  void writeSensorReading({
    deviceSlug: parsed.deviceSlug,
    entityId: parsed.entityId,
    value: num,
  }).catch(() => {
    /* history is best-effort; live state still works */
  });
}
