import type { Capability } from "../api";

/** ESPHome internal GPIO outputs / status LEDs — not user-facing relays. */
export function isInternalRelayEntity(
  name: string,
  entityId?: string | null
): boolean {
  const n = name.trim().toLowerCase();
  const id = (entityId ?? "").trim().toLowerCase();
  if (id.startsWith("output_") || id.startsWith("led_")) return true;
  if (/^output\s/.test(n)) return true;
  if (n === "red" || n === "green") return true;
  return false;
}

/** Switch capabilities eligible for relay widgets and the add-widget picker. */
export function isControllableSwitch(cap: Capability): boolean {
  if (cap.kind !== "switch") return false;
  if (!cap.hasCommand) return false;
  return !isInternalRelayEntity(cap.name);
}

export function controllableSwitches(capabilities: Capability[]): Capability[] {
  return capabilities.filter(isControllableSwitch);
}

/** Entity names that are channel placeholders, not useful titles on their own. */
export function isGenericRelayEntityName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  return /^(switch|relay)([_\s-]?\d+)?$/i.test(n);
}

function isGenericEntityName(name: string): boolean {
  return isGenericRelayEntityName(name);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Drop redundant area suffixes from device names, e.g.
 * "Lights - Living Room" + area "Living Room" → "Lights".
 */
export function tidyDeviceName(
  deviceName: string | null | undefined,
  roomName?: string | null
): string {
  const device = (deviceName ?? "").trim();
  const area = roomName?.trim();
  if (!device || !area) return device;

  const dashSuffix = new RegExp(
    `\\s*[-–—]\\s*${escapeRegExp(area)}\\s*$`,
    "i"
  );
  const trimmed = device.replace(dashSuffix, "").trim();
  if (trimmed && trimmed.toLowerCase() !== area.toLowerCase()) {
    return trimmed;
  }
  return device;
}

/** True when the device label already contains the area (e.g. "Garden Relays"). */
function deviceMentionsArea(device: string, area: string): boolean {
  return device.toLowerCase().includes(area.toLowerCase());
}

/**
 * Main name shown on the widget (and as the first half of picker labels).
 * Prefers a meaningful entity name; falls back to the device name for
 * generic "Switch" / bare channel labels. Keeps "Relay 1" so multi-channel
 * boards stay distinguishable.
 */
export function capabilityWidgetTitle(
  cap: Pick<Capability, "name" | "deviceName" | "roomName"> | undefined,
  fallback = "Widget",
  opts?: { prefixDeviceForGenericRelay?: boolean }
): string {
  if (!cap) return fallback;
  const entity = (cap.name ?? "").trim() || "";
  const device = tidyDeviceName(cap.deviceName, cap.roomName);
  if (!entity) return device || fallback;
  if (!isGenericEntityName(entity)) return entity;
  if (/^relay/i.test(entity)) {
    if (opts?.prefixDeviceForGenericRelay && device) return `${device} · ${entity}`;
    return entity;
  }
  return device || entity || fallback;
}

/**
 * Secondary line under a widget: where this control lives.
 *
 * Named relays (Waterfall, Sprinklers, …) → area only: "Garden"
 *   (not "Garden Relays · Garden" — the board name is noise on the dashboard)
 * Generic Relay N / Switch → device (± area if not already in the device name)
 */
export function capabilityLocationLabel(cap: Capability | undefined): string {
  if (!cap) return "No capability bound";
  const area = cap.roomName?.trim() || "";
  const device = tidyDeviceName(cap.deviceName, cap.roomName);
  const entity = (cap.name ?? "").trim() || "";
  const title = capabilityWidgetTitle(cap);

  const needsBoardContext =
    isGenericEntityName(entity) ||
    title.toLowerCase() === device.toLowerCase();

  if (!needsBoardContext) {
    // Meaningful name like "Waterfall" — room is enough when set.
    if (area) return area;
    if (device && device.toLowerCase() !== title.toLowerCase()) return device;
    return "";
  }

  // Generic channel / title is the device itself — show board + room carefully.
  const parts: string[] = [];
  if (device && device.toLowerCase() !== title.toLowerCase()) {
    parts.push(device);
  }
  if (area && (!device || !deviceMentionsArea(device, area))) {
    parts.push(area);
  }
  return parts.join(" · ");
}

/** Area line for switch widgets — room name when set, else location helper. */
export function switchWidgetAreaLine(cap: Capability | undefined): string {
  if (!cap) return "";
  const area = cap.roomName?.trim();
  if (area) return area;
  const loc = capabilityLocationLabel(cap);
  if (loc && loc !== "No capability bound") return loc;
  return tidyDeviceName(cap.deviceName, cap.roomName);
}

/** Dropdown label: Device › Sensor (unit). */
export function capabilityPickerLabel(cap: Capability): string {
  const device = tidyDeviceName(cap.deviceName, cap.roomName);
  const area = cap.roomName?.trim();
  const group =
    area && device && !deviceMentionsArea(device, area)
      ? `${device} · ${area}`
      : device || "Unassigned device";
  const name = cap.name?.trim() || capabilityWidgetTitle(cap);
  const primary = cap.unit?.trim() ? `${name} (${cap.unit.trim()})` : name;
  return `${group} › ${primary}`;
}

/** Default widget title from the bound entity (not the catalog type name). */
export function defaultWidgetTitle(
  cap: Capability | undefined,
  fallbackTypeLabel: string
): string {
  return capabilityWidgetTitle(cap, fallbackTypeLabel);
}
