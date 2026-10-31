/** Client-safe device helpers. */

export type DeviceConnectivityState = "online" | "no_recent_data" | "offline";

export function deviceConnectivityState(device: {
  connectivityState?: DeviceConnectivityState;
  isOnline?: boolean;
}): DeviceConnectivityState {
  if (device.connectivityState) return device.connectivityState;
  return device.isOnline ? "online" : "offline";
}

export function connectivityLabel(state: DeviceConnectivityState): string {
  if (state === "online") return "Online";
  if (state === "no_recent_data") return "No recent data";
  return "Offline";
}

export function connectivityChipColor(
  state: DeviceConnectivityState
): "success" | "default" | "warning" {
  if (state === "online") return "success";
  if (state === "no_recent_data") return "default";
  return "warning";
}

export function formatLastSeen(iso: string | Date | null | undefined): string {
  if (!iso) return "Never";
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return "Just now";
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function esphomeDashboardUrl(hostname: string, esphomeName?: string | null): string {
  const base = `http://${hostname}:6052`;
  if (!esphomeName) return base;
  return `${base}/dashboard/${encodeURIComponent(esphomeName)}`;
}

export function friendlyDeviceName(esphomeName: string): string {
  return esphomeName
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: "Draft",
  configured: "Configured",
  validation_failed: "Validation failed",
  ready_to_build: "Ready to build",
  building: "Building",
  firmware_ready: "Firmware ready",
  awaiting_installation: "Awaiting installation",
  connecting: "Waiting for device",
  online: "Online",
  offline: "Offline",
  error: "Error",
  configuration_missing: "YAML missing",
};

export function esphomeLifecycleLabel(state: string | null | undefined): string | null {
  if (!state) return null;
  return LIFECYCLE_LABELS[state] ?? state.replace(/_/g, " ");
}

/** Build/install/config lifecycle — excludes MQTT connectivity states. */
/** @deprecated Use ESPHOME_INSTALL_WORKFLOW_TITLE from esphome-install-guide.ts */
export { ESPHOME_INSTALL_WORKFLOW_TITLE as ESPHOME_WIZARD_INSTALL_TITLE } from "./esphome-install-guide";
