/**
 * Topics the API MQTT client should subscribe to for live telemetry.
 */
export function collectMqttSubscriptionTopics(input: {
  installationRoot: string;
  devicePrefixes: string[];
  bindingStateTopics: string[];
}): string[] {
  const topics = new Set<string>();
  const root = input.installationRoot.trim();
  if (root) {
    topics.add(`${root}/#`);
  }
  for (const prefix of input.devicePrefixes) {
    if (!prefix) continue;
    topics.add(`${prefix}/#`);
  }
  for (const topic of input.bindingStateTopics) {
    if (!topic) continue;
    topics.add(topic);
  }
  return [...topics].sort();
}

/** Device slug from `nexternel/garden-relays` → `garden-relays`. */
export function deviceSlugFromMqttPrefix(prefix: string): string | null {
  const slash = prefix.indexOf("/");
  if (slash === -1) return null;
  const slug = prefix.slice(slash + 1).trim();
  return slug || null;
}
