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
  // One subscription per message: a topic already covered by a wider "…/#" is left out, otherwise the
  // message service sends Nexternel the same message once for each (every message arrived twice).
  return [...topics].filter((t) => ![...topics].some((other) => other !== t && covers(other, t))).sort();
}

/** True when the filter `wide` ("a/#") also matches every message of `narrow` ("a/b/#", "a/b/c"). */
export function covers(wide: string, narrow: string): boolean {
  if (!wide.endsWith("/#")) return false;
  const base = wide.slice(0, -2);
  return narrow === base || narrow.startsWith(`${base}/`);
}

/** Device slug from `nexternel/garden-relays` → `garden-relays`. */
export function deviceSlugFromMqttPrefix(prefix: string): string | null {
  const slash = prefix.indexOf("/");
  if (slash === -1) return null;
  const slug = prefix.slice(slash + 1).trim();
  return slug || null;
}
