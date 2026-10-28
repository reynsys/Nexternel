import type { AddonInfo } from "../../../api";

/** How a licensed (paid) extension's status reads on Settings → Extensions. */
export const ADDON_STATUS: Record<AddonInfo["status"], { label: string; color: "success" | "warning" | "error" }> = {
  active: { label: "Active", color: "success" },
  expired: { label: "Needs a check", color: "warning" },
  revoked: { label: "Cancelled", color: "error" },
  broken: { label: "Needs the key again", color: "error" },
};

export function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}
