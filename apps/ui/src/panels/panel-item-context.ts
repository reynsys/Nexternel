import type { Capability, ResolvedPanelCapability } from "../api";
import { capabilityLocationLabel } from "../lib/capability-labels";
import { asSwitchCapability } from "./panel-capabilities";

/** Normalize resolved panel rows to the shared capability shape. */
export function capabilityFromPanelItem(
  cap: Capability | ResolvedPanelCapability
): Capability {
  if ("areaName" in cap) {
    return asSwitchCapability(cap);
  }
  return cap;
}

/**
 * Short location caption for panel tiles — area when set, otherwise device.
 * Same rules as switches (no noisy board names on named relays).
 */
export function panelItemContextLine(cap: Capability | ResolvedPanelCapability): string {
  return capabilityLocationLabel(capabilityFromPanelItem(cap));
}
