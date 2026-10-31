import type { BoardStatus, Capability, DeviceRecord } from "../../../api";
import { deviceConnectivityState } from "../../../lib/device-utils";
import { parseCapabilityReading } from "../../../panels/parse-capability-reading";

/**
 * What the Devices page says about a device in a few words — the same for every kind of device:
 * one status word with its tone, and a short live summary (its readings' values, its switches).
 */
export type StatusTone = "ok" | "warn" | "bad" | "off";
export type DeviceStatus = { word: string; tone: StatusTone };

const PROBLEM_LIFECYCLE = new Set(["error", "configuration_missing", "validation_failed"]);

export function deviceStatus(d: DeviceRecord, board?: BoardStatus | null): DeviceStatus {
  if (!d.isEnabled) return { word: "Switched off", tone: "off" };
  if (PROBLEM_LIFECYCLE.has(d.esphomeLifecycleState ?? "")) return { word: "Needs attention", tone: "warn" };
  const c = deviceConnectivityState(d);
  if (c === "offline") return { word: "Offline", tone: "bad" };
  if (c === "no_recent_data") return { word: "No recent data", tone: "warn" };
  if (board?.updateState === "update") return { word: "Update ready", tone: "warn" };
  return { word: "Online", tone: "ok" };
}

/** "21.4 °C" — a reading's live value as the panels show it ("—" when there is none). */
export function readingValue(cap: Pick<Capability, "state" | "unit"> | undefined): string {
  const r = parseCapabilityReading(cap ?? undefined);
  return r.unit ? `${r.value} ${r.unit}` : r.value;
}

/** A switch's state in words. */
export function switchWord(state: string | null | undefined): string {
  const s = (state ?? "").toUpperCase();
  return s === "ON" || s === "TRUE" || s === "1" ? "On" : s === "OFF" || s === "FALSE" || s === "0" ? "Off" : "—";
}

/** "CO2 640 ppm · 20.9 °C" / "4 switches · all off" — at most three readings, then the switches. */
export function deviceSummary(d: DeviceRecord, values: Map<string, Capability>): string {
  const parts: string[] = [];
  const sensors = d.sensors.filter((x) => x.isEnabled);
  const shown = sensors.slice(0, 3).map((s) => readingValue((s.capabilityId && values.get(s.capabilityId)) || { state: null, unit: s.unit }));
  // No values yet (just added, or not sending): say how many readings instead of a row of dashes.
  if (shown.some((v) => v !== "—")) parts.push(...shown);
  else if (sensors.length) parts.push(sensors.length === 1 ? "1 reading" : `${sensors.length} readings`);
  const relays = d.relays.filter((r) => r.isEnabled);
  if (relays.length) {
    const on = relays.filter((r) => switchWord(r.lastState) === "On").length;
    const word = relays.length === 1 ? "1 switch" : `${relays.length} switches`;
    parts.push(`${word} · ${on === 0 ? "all off" : on === relays.length ? (relays.length === 1 ? "on" : "all on") : `${on} on`}`);
  }
  if (!parts.length) return d.firmwareType === "shelly" ? "Shelly switch" : "No readings yet";
  return parts.join(" · ");
}
