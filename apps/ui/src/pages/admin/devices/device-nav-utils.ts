import type { DeviceRecord } from "../../../api";
import { deviceConnectivityState } from "../../../lib/device-utils";
import { AREA } from "../../../lib/area-labels";

export const OCTOPUS_SERVICE_ID = "octopus" as const;
export const OCTOPUS_DEVICE_SLUG = "octopus-home-mini";

export type DeviceSelection =
  | { kind: "device"; deviceId: string }
  | { kind: "service"; serviceId: typeof OCTOPUS_SERVICE_ID }
  /** A camera; cameraId "new" = adding one. */
  | { kind: "camera"; cameraId: string }
  | null;

export type StatusFilter = "all" | "online" | "offline" | "no_recent_data" | "needs_attention";
export type TypeFilter = "all" | "esphome" | "shelly" | "camera" | "service";

export const UNASSIGNED_AREA_KEY = "__unassigned__";
export const COLLAPSED_AREAS_STORAGE_KEY = "nexternel-devices-nav-collapsed";

export function isPhysicalDevice(d: DeviceRecord): boolean {
  if (d.slug === OCTOPUS_DEVICE_SLUG) return false;
  const t = (d.firmwareType || "esphome").toLowerCase();
  return t !== "octopus";
}

export function deviceTypeLabel(d: DeviceRecord): string {
  const t = d.firmwareType || "esphome";
  if (t === "shelly") return "Shelly";
  if (t === "octopus") return "Octopus";
  return "ESPHome";
}

export function deviceNeedsAttention(d: DeviceRecord): boolean {
  if (!d.isEnabled) return false;
  const connectivity = deviceConnectivityState(d);
  if (connectivity === "offline") return true;
  const lc = d.esphomeLifecycleState;
  if (lc === "error" || lc === "configuration_missing" || lc === "validation_failed") {
    return true;
  }
  if (lc === "connecting" && connectivity !== "online") return true;
  return false;
}

export function capabilityCount(d: DeviceRecord): number {
  return d.sensors.length + d.relays.length;
}

export function deviceMatchesSearch(d: DeviceRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (d.name.toLowerCase().includes(q)) return true;
  if (d.roomName?.toLowerCase().includes(q)) return true;
  if (d.slug.toLowerCase().includes(q)) return true;
  for (const s of d.sensors) {
    if (s.name.toLowerCase().includes(q)) return true;
  }
  for (const r of d.relays) {
    if (r.name.toLowerCase().includes(q)) return true;
  }
  return false;
}

export function deviceMatchesStatusFilter(d: DeviceRecord, filter: StatusFilter): boolean {
  const connectivity = deviceConnectivityState(d);
  if (filter === "all") return true;
  if (filter === "online") return connectivity === "online";
  if (filter === "offline") return connectivity === "offline";
  if (filter === "no_recent_data") return connectivity === "no_recent_data";
  if (filter === "needs_attention") return deviceNeedsAttention(d);
  return true;
}

export function deviceMatchesTypeFilter(d: DeviceRecord, filter: TypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "esphome") return (d.firmwareType || "esphome") === "esphome";
  if (filter === "shelly") return d.firmwareType === "shelly";
  // Cameras and online services are listed in their own groups.
  return false;
}

export function filterPhysicalDevices(
  devices: DeviceRecord[],
  opts: {
    search: string;
    statusFilter: StatusFilter;
    typeFilter: TypeFilter;
  }
): DeviceRecord[] {
  return devices.filter(
    (d) =>
      isPhysicalDevice(d) &&
      deviceMatchesSearch(d, opts.search) &&
      deviceMatchesStatusFilter(d, opts.statusFilter) &&
      deviceMatchesTypeFilter(d, opts.typeFilter)
  );
}

export type AreaGroup = {
  key: string;
  label: string;
  devices: DeviceRecord[];
};

export function groupDevicesByArea(
  devices: DeviceRecord[],
  areaOrder: { id: string; name: string }[]
): AreaGroup[] {
  const physical = devices.filter(isPhysicalDevice);
  const byKey = new Map<string, DeviceRecord[]>();

  for (const d of physical) {
    const key = d.roomId ?? UNASSIGNED_AREA_KEY;
    const list = byKey.get(key) ?? [];
    list.push(d);
    byKey.set(key, list);
  }

  const groups: AreaGroup[] = [];

  for (const area of areaOrder) {
    const list = byKey.get(area.id);
    if (!list?.length) continue;
    groups.push({
      key: area.id,
      label: area.name,
      devices: list.sort((a, b) => a.name.localeCompare(b.name)),
    });
    byKey.delete(area.id);
  }

  const unassigned = byKey.get(UNASSIGNED_AREA_KEY);
  if (unassigned?.length) {
    groups.push({
      key: UNASSIGNED_AREA_KEY,
      label: `Unassigned`,
      devices: unassigned.sort((a, b) => a.name.localeCompare(b.name)),
    });
    byKey.delete(UNASSIGNED_AREA_KEY);
  }

  for (const [key, list] of byKey) {
    if (!list.length) continue;
    groups.push({
      key,
      label: list[0]?.roomName ?? `No ${AREA.singular}`,
      devices: list.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return groups;
}

export function parseSelectionFromSearchParams(
  params: URLSearchParams
): DeviceSelection {
  const service = params.get("service");
  if (service === OCTOPUS_SERVICE_ID) {
    return { kind: "service", serviceId: OCTOPUS_SERVICE_ID };
  }
  const deviceId = params.get("device");
  if (deviceId) return { kind: "device", deviceId };
  const cameraId = params.get("camera");
  if (cameraId) return { kind: "camera", cameraId };
  return null;
}

export function selectionToSearchParams(selection: DeviceSelection): Record<string, string> {
  if (!selection) return {};
  if (selection.kind === "service") return { service: selection.serviceId };
  if (selection.kind === "camera") return { camera: selection.cameraId };
  return { device: selection.deviceId };
}

export function readCollapsedAreaKeys(): Set<string> {
  try {
    const raw = sessionStorage.getItem(COLLAPSED_AREAS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function writeCollapsedAreaKeys(keys: Set<string>) {
  sessionStorage.setItem(COLLAPSED_AREAS_STORAGE_KEY, JSON.stringify([...keys]));
}
