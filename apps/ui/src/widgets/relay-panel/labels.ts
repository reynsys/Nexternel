import type { Capability } from "../../api";
import {
  capabilityWidgetTitle,
  isGenericRelayEntityName,
  tidyDeviceName,
} from "../../lib/capability-labels";

export type RelayPanelConfig = {
  relayLabels: Record<string, string>;
};

export function parseRelayPanelConfig(
  config: Record<string, unknown> | undefined
): RelayPanelConfig {
  const relayLabels: Record<string, string> = {};
  const raw = config?.relayLabels;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string" && value.trim()) {
        relayLabels[key] = value.trim();
      }
    }
  }
  return { relayLabels };
}

/** Stable key for per-widget row label overrides (relay source id preferred). */
export function relayLabelKey(cap: Capability): string {
  if (cap.sourceType === "relay" && cap.sourceId) return `relay:${cap.sourceId}`;
  return `cap:${cap.id}`;
}

export function relayRowLabel(
  cap: Capability,
  config: RelayPanelConfig,
  multiDevice: boolean
): string {
  const custom = config.relayLabels[relayLabelKey(cap)];
  if (custom) return custom;

  const entity = (cap.name ?? "").trim();
  const device = tidyDeviceName(cap.deviceName, cap.roomName);

  if (multiDevice) {
    if (entity && !isGenericRelayEntityName(entity)) {
      return `${device} · ${entity}`;
    }
    if (entity) return `${device} · ${entity}`;
    return device || capabilityWidgetTitle(cap, "Relay");
  }

  return capabilityWidgetTitle(cap, "Relay", { prefixDeviceForGenericRelay: true });
}

export function relayPanelLocationLabel(relays: Capability[]): string {
  if (relays.length === 0) return "";
  const areas = new Set<string>();
  for (const cap of relays) {
    const area = cap.roomName?.trim();
    if (area) areas.add(area);
  }
  if (areas.size === 1) return Array.from(areas)[0];
  if (areas.size > 1) return Array.from(areas).sort((a, b) => a.localeCompare(b)).join(" · ");

  const devices = new Set(
    relays.map((c) => tidyDeviceName(c.deviceName, c.roomName)).filter(Boolean)
  );
  if (devices.size === 1) return Array.from(devices)[0];
  return "";
}
