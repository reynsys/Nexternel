import { isShellyGen1MqttPrefix, normalizeShellyTopicPrefix } from "./topics.js";

/** Reject Gen2/Gen3 Shelly rows that use the installation MQTT root as device prefix. */
export function assertValidShellyMqttPrefix(
  mqttTopicPrefix: string,
  installationRoot: string
): void {
  if (isShellyGen1MqttPrefix(mqttTopicPrefix)) return;
  const prefix = normalizeShellyTopicPrefix(mqttTopicPrefix).toLowerCase();
  const root = installationRoot.trim().toLowerCase();
  if (prefix === root) {
    throw new Error(
      "Shelly Gen2/Gen3 MQTT topic prefix must be the device id (e.g. shelly1minig3-xxxxxxxx), not the installation MQTT root."
    );
  }
}
