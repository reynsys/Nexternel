import type { DeviceRecord } from "../../../api";

export const OCTOPUS_SERVICE_ID = "octopus" as const;
export const OCTOPUS_DEVICE_SLUG = "octopus-home-mini";

export type DeviceSelection =
  | { kind: "device"; deviceId: string }
  | { kind: "service"; serviceId: typeof OCTOPUS_SERVICE_ID }
  /** A camera; cameraId "new" = adding one. */
  | { kind: "camera"; cameraId: string }
  | null;

/** The quick filters above the Devices list. */
export type StatusFilter = "all" | "needs_attention" | "offline";

export function isPhysicalDevice(d: DeviceRecord): boolean {
  if (d.slug === OCTOPUS_DEVICE_SLUG) return false;
  const t = (d.firmwareType || "esphome").toLowerCase();
  return t !== "octopus";
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

