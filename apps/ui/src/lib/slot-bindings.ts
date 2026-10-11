import type { WidgetBindingSlotDef } from "@nexternel/plugin-sdk";
import type { Capability } from "../api";
import { isControllableSwitch } from "./capability-labels";

function nameMatches(cap: Capability, hints?: string[]): boolean {
  if (!hints?.length) return true;
  const name = (cap.name ?? "").toLowerCase();
  return hints.some((h) => name.includes(h.toLowerCase()));
}

function kindMatches(cap: Capability, kinds?: string[]): boolean {
  if (!kinds?.length) return true;
  return kinds.includes(cap.kind);
}

/** Best-effort auto-bind for composite widget slot definitions. */
export function suggestSlotBindings(
  slots: WidgetBindingSlotDef[],
  capabilities: Capability[],
  opts?: { deviceId?: string; deviceName?: string }
): Record<string, string> {
  let pool = capabilities;
  if (opts?.deviceId) {
    pool = pool.filter((c) => c.deviceId === opts.deviceId);
  } else if (opts?.deviceName) {
    const needle = opts.deviceName.toLowerCase();
    const onDevice = pool.filter((c) =>
      (c.deviceName ?? "").toLowerCase().includes(needle)
    );
    if (onDevice.length > 0) pool = onDevice;
  }

  const used = new Set<string>();
  const result: Record<string, string> = {};

  for (const slot of slots) {
    const candidates = pool.filter(
      (c) =>
        !used.has(c.id) &&
        kindMatches(c, slot.kinds) &&
        nameMatches(c, slot.nameHints) &&
        (c.kind !== "switch" || isControllableSwitch(c))
    );
    const match = candidates[0];
    if (match) {
      result[slot.key] = match.id;
      used.add(match.id);
    }
  }

  return result;
}

export function capabilitiesForSlot(
  capabilities: Capability[],
  slot: WidgetBindingSlotDef
): Capability[] {
  return capabilities.filter(
    (c) =>
      kindMatches(c, slot.kinds) &&
      nameMatches(c, slot.nameHints) &&
      (c.kind !== "switch" || isControllableSwitch(c))
  );
}
