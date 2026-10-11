/**
 * Canonical ESPHome MQTT topic paths (sensor/switch + entity id).
 */
export function esphomeSensorStateTopic(
  devicePrefix: string,
  entityId: string
): string {
  return `${devicePrefix}/sensor/${entityId}/state`;
}

export function esphomeSwitchStateTopic(
  devicePrefix: string,
  entityId: string
): string {
  return `${devicePrefix}/switch/${entityId}/state`;
}

export function esphomeSwitchCommandTopic(
  devicePrefix: string,
  entityId: string
): string {
  return `${devicePrefix}/switch/${entityId}/command`;
}

/** Prefix aliases the API should accept (stored prefix + installation root + slug). */
export function esphomeDevicePrefixAliases(
  storedPrefix: string,
  deviceSlug: string,
  installationRoot: string
): string[] {
  const aliases = new Set<string>();
  const stored = storedPrefix.trim();
  const slug = deviceSlug.trim();
  const root = installationRoot.trim();
  if (stored) aliases.add(stored);
  if (root && slug) aliases.add(`${root}/${slug}`);
  return [...aliases];
}
