import type { AddonInfo } from "../api";

/**
 * What Settings → Extensions → Check for updates found, in one or two sentences. Paid styles update
 * by themselves during the check (compared before and after); features have a newer version ready
 * that the person installs with its own Update button.
 */
export function describeExtensionCheck(
  before: AddonInfo[],
  after: AddonInfo[],
  featureUpdates: { name: string; version: string }[] = [],
  catalogReached = true
): { text: string; ok: boolean } {
  const old = new Map(before.map((a) => [a.id, a]));
  const updated = after.filter((a) => old.has(a.id) && old.get(a.id)!.version !== a.version);
  const lost = after.filter((a) => a.status === "revoked" && old.get(a.id)?.status !== "revoked");
  const shopReached = !after.length || after.some((a) => a.checkedAt && a.checkedAt !== old.get(a.id)?.checkedAt);
  const parts: string[] = [];
  if (updated.length) parts.push(`Updated: ${updated.map((a) => `${a.name} to ${a.version}`).join(", ")}.`);
  if (featureUpdates.length) {
    parts.push(`Update ready: ${featureUpdates.map((f) => `${f.name} ${f.version}`).join(", ")}.`);
  }
  if (lost.length) parts.push(`No longer included in your licence: ${lost.map((a) => a.name).join(", ")}.`);
  if (!shopReached) parts.push("Paid Looks not checked: no answer from the Nexternel shop.");
  if (!catalogReached) parts.push("Features not checked: no answer.");
  if (parts.length) return { text: parts.join(" "), ok: lost.length === 0 && shopReached && catalogReached };
  return { text: "Everything is up to date.", ok: true };
}
