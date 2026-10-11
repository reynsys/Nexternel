import type { Capability } from "../api";
import {
  capabilityWidgetTitle,
  tidyDeviceName,
} from "./capability-labels";

function deviceMentionsArea(device: string, area: string): boolean {
  return device.toLowerCase().includes(area.toLowerCase());
}

/** Group header in capability pickers: device (+ room when helpful). */
export function capabilityDeviceGroupLabel(cap: Capability): string {
  const device = tidyDeviceName(cap.deviceName, cap.roomName);
  const area = cap.roomName?.trim();
  if (area && device && !deviceMentionsArea(device, area)) {
    return `${device} · ${area}`;
  }
  return device || "Unassigned device";
}

/** Primary line for a sensor/relay row inside a device group. */
export function capabilityOptionPrimary(
  cap: Pick<Capability, "name" | "unit" | "deviceName" | "roomName">
): string {
  const name = (cap.name ?? "").trim() || capabilityWidgetTitle(cap);
  if (cap.unit?.trim()) return `${name} (${cap.unit.trim()})`;
  return name;
}

/** Context line: place · device (e.g. Utility Room · Utility Room ESP32). */
export function capabilityOptionContextLine(cap: Capability): string {
  const area = (cap.roomName ?? "").trim();
  const device = tidyDeviceName(cap.deviceName, cap.roomName);
  const parts: string[] = [];
  if (area) parts.push(area);
  if (device) {
    if (!area || device.toLowerCase() !== area.toLowerCase()) {
      parts.push(device);
    }
  }
  return parts.join(" · ") || device || "Unassigned";
}

export function capabilityKindHint(kind: string | undefined): string {
  if (!kind) return "Sensor";
  switch (kind) {
    case "power":
      return "Power";
    case "energy":
      return "Energy";
    case "temperature":
      return "Temperature";
    case "humidity":
      return "Humidity";
    case "pressure":
      return "Pressure";
    case "switch":
      return "Switch";
    case "binary_sensor":
      return "Binary";
    default:
      return kind.replace(/_/g, " ");
  }
}

function formatLiveSnippet(cap: Capability): string {
  const state = cap.state;
  if (!state || state.quality === "unknown" || state.quality === "stale") return "";
  const v = state.value;
  if (typeof v === "number" && Number.isFinite(v)) {
    return `now: ${v}${cap.unit?.trim() ? ` ${cap.unit.trim()}` : ""}`;
  }
  if (typeof v === "boolean") return `now: ${v ? "on" : "off"}`;
  if (v != null && String(v).trim()) return `now: ${String(v)}`;
  return "";
}

/** Secondary hint under each option (kind + optional live reading). */
export function capabilityOptionSecondary(cap: Capability): string {
  const parts = [capabilityKindHint(cap.kind)];
  const live = formatLiveSnippet(cap);
  if (live) parts.push(live);
  return parts.join(" · ");
}

/** Flat search string for filtering autocomplete options. */
export function capabilitySearchBlob(cap: Capability): string {
  return [
    capabilityDeviceGroupLabel(cap),
    cap.deviceName ?? "",
    cap.roomName ?? "",
    cap.name ?? "",
    cap.kind,
    cap.unit ?? "",
    capabilityOptionPrimary(cap),
  ]
    .join(" ")
    .toLowerCase();
}

export function capabilityMatchesSearch(cap: Capability, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return capabilitySearchBlob(cap).includes(q);
}

/** Sort for MUI Autocomplete `groupBy` (must be grouped contiguously). */
export function sortCapabilitiesForPicker(caps: Capability[]): Capability[] {
  return [...caps].sort((a, b) => {
    const ga = capabilityDeviceGroupLabel(a).toLowerCase();
    const gb = capabilityDeviceGroupLabel(b).toLowerCase();
    if (ga !== gb) return ga.localeCompare(gb);
    return capabilityOptionPrimary(a).toLowerCase().localeCompare(
      capabilityOptionPrimary(b).toLowerCase()
    );
  });
}

export function filterCapabilitiesForPicker(
  caps: Capability[],
  query: string
): Capability[] {
  return sortCapabilitiesForPicker(caps.filter((c) => capabilityMatchesSearch(c, query)));
}

/** Full flat label when grouping is not shown (e.g. tooltips). */
export function capabilityPickerFlatLabel(cap: Capability): string {
  return `${capabilityDeviceGroupLabel(cap)} › ${capabilityOptionPrimary(cap)}`;
}
