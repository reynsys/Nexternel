/** The MQTT topic roots an older installation used (e.g. "damnhome"), to move devices onto this one's. */
export function collectOldTopicRoots(
  operationalPrefix: string | undefined,
  domainPrefixes: string[]
): string[] {
  const roots = new Set<string>();
  if (operationalPrefix?.trim()) roots.add(operationalPrefix.trim());
  for (const prefix of domainPrefixes) {
    const parts = prefix.trim().split("/").filter((part) => part.length > 0);
    if (parts.length < 2) continue;
    const root = parts[0];
    if (root && root.toLowerCase() !== "shellies") roots.add(root);
  }
  return Array.from(roots);
}
