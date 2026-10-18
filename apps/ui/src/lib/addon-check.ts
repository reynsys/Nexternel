import type { AddonInfo } from "../api";

/** What "Check for add-on updates" found, in one sentence: compares the list before and after. */
export function describeAddonCheck(before: AddonInfo[], after: AddonInfo[]): { text: string; ok: boolean } {
  const old = new Map(before.map((a) => [a.id, a]));
  const updated = after.filter((a) => old.has(a.id) && old.get(a.id)!.version !== a.version);
  const lost = after.filter((a) => a.status === "revoked" && old.get(a.id)?.status !== "revoked");
  const reached = after.some((a) => a.checkedAt && a.checkedAt !== old.get(a.id)?.checkedAt);
  const parts: string[] = [];
  if (updated.length) parts.push(`Updated: ${updated.map((a) => `${a.name} to ${a.version}`).join(", ")}.`);
  if (lost.length) parts.push(`No longer included in your licence: ${lost.map((a) => a.name).join(", ")}.`);
  if (parts.length) return { text: parts.join(" "), ok: lost.length === 0 };
  if (!reached) return { text: "Could not reach the Nexternel shop. Your add-ons keep working; try again later.", ok: false };
  return { text: "All add-ons are up to date.", ok: true };
}
