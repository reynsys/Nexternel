import { deviceIdsFromBindings } from "@nexternel/domain";
import type { Capability } from "../../api";
import { controllableSwitches, tidyDeviceName } from "../../lib/capability-labels";

export const RELAY_PANEL_TYPES = [
  "relay_panel",
  "relay_panel_list",
  "relay_panel_grid",
] as const;

export type RelayPanelType = (typeof RELAY_PANEL_TYPES)[number];

export function isRelayPanelType(type: string): boolean {
  return RELAY_PANEL_TYPES.includes(type as RelayPanelType);
}

export function relayPanelLabel(type: string): string {
  if (type === "relay_panel_grid") return "Relay panel (grid)";
  if (type === "relay_panel_list") return "Relay panel (list)";
  return "Relay panel";
}

export function relayDeviceOptionLabel(d: DeviceRelayOption): string {
  const name = tidyDeviceName(d.deviceName, d.roomName);
  const countLabel = `${d.relayCount} switch${d.relayCount === 1 ? "" : "es"}`;
  if (d.roomName?.trim()) {
    return `${name} · ${d.roomName.trim()} (${countLabel})`;
  }
  return `${name} (${countLabel})`;
}

export function relayPanelLayout(type: string): "list" | "grid" {
  return type === "relay_panel_grid" ? "grid" : "list";
}

/** Column count — list mode auto-compacts to 2–3 columns so the panel does not grow endlessly. */
export function resolveRelayPanelColumns(
  relayCount: number,
  layout: "list" | "grid",
  multiDevice: boolean
): number {
  if (relayCount <= 0) return 1;
  if (layout === "grid") {
    return relayCount >= 8 ? 3 : 2;
  }
  if (multiDevice) {
    return relayCount >= 6 ? 3 : 2;
  }
  if (relayCount <= 2) return 1;
  if (relayCount <= 6) return 2;
  return 3;
}

/** Suggested grid row height (dashboard cells) for a relay count. */
export function relayPanelSuggestedHeight(relayCount: number, columns: number): number {
  if (relayCount <= 0) return 3;
  const rows = Math.ceil(relayCount / columns);
  return Math.min(8, Math.max(3, rows + 1));
}

export function relayPanelDefaultLayout(
  type: string,
  relayCount = 0,
  multiDevice = false
): {
  w: number;
  h: number;
  minW: number;
  minH: number;
} {
  const layout = relayPanelLayout(type);
  const cols = resolveRelayPanelColumns(relayCount, layout, multiDevice);
  const h = relayPanelSuggestedHeight(relayCount, cols);
  if (type === "relay_panel_grid") {
    return { w: 4, h, minW: 3, minH: 3 };
  }
  return { w: 4, h, minW: 3, minH: 3 };
}

export function relayPanelDeviceIds(bindings: unknown): string[] {
  return deviceIdsFromBindings(bindings);
}

/** @deprecated use relayPanelDeviceIds */
export function relayPanelDeviceId(bindings: unknown): string | undefined {
  return relayPanelDeviceIds(bindings)[0];
}

export type DeviceRelayOption = {
  deviceId: string;
  deviceName: string;
  roomName: string | null;
  relayCount: number;
};

export function devicesWithControllableRelays(capabilities: Capability[]): DeviceRelayOption[] {
  const map = new Map<string, DeviceRelayOption>();
  for (const cap of controllableSwitches(capabilities)) {
    const existing = map.get(cap.deviceId);
    if (existing) {
      existing.relayCount += 1;
      continue;
    }
    map.set(cap.deviceId, {
      deviceId: cap.deviceId,
      deviceName: tidyDeviceName(cap.deviceName, cap.roomName),
      roomName: cap.roomName ?? null,
      relayCount: 1,
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    a.deviceName.localeCompare(b.deviceName)
  );
}

export function controllableRelaysForDevices(
  capabilities: Capability[],
  deviceIds: string[]
): Capability[] {
  const allowed = new Set(deviceIds);
  return controllableSwitches(capabilities)
    .filter((c) => allowed.has(c.deviceId))
    .sort((a, b) => {
      const deviceCmp = tidyDeviceName(a.deviceName, a.roomName).localeCompare(
        tidyDeviceName(b.deviceName, b.roomName)
      );
      if (deviceCmp !== 0) return deviceCmp;
      return a.name.localeCompare(b.name);
    });
}

export function controllableRelaysForDevice(
  capabilities: Capability[],
  deviceId: string
): Capability[] {
  return controllableRelaysForDevices(capabilities, [deviceId]);
}

export function relayPanelDefaultTitle(
  capabilities: Capability[],
  deviceIds: string[]
): string | undefined {
  const relays = controllableRelaysForDevices(capabilities, deviceIds);
  if (relays.length === 0) return undefined;

  const rooms = new Set(relays.map((r) => r.roomName?.trim()).filter(Boolean) as string[]);
  if (rooms.size === 1) return Array.from(rooms)[0];

  if (deviceIds.length === 1) {
    return tidyDeviceName(relays[0].deviceName, relays[0].roomName);
  }

  const devices = devicesWithControllableRelays(capabilities).filter((d) =>
    deviceIds.includes(d.deviceId)
  );
  if (devices.length === 2) {
    return devices.map((d) => d.deviceName).join(" · ");
  }
  return "Switches";
}
