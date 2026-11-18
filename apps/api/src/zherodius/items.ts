/**
 * A Zherodius device's parts (Zh.GetInfo) as Nexternel items: each relay is a switch, and each sensor
 * gives one item per reading it takes (temperature, humidity, pressure).
 */
import type { DeviceInfo, DeviceStatus } from "./line.js";

export type Reading = "t" | "h" | "p";

const READING: Record<Reading, { sensorType: string; unit: string; word: string }> = {
  t: { sensorType: "temperature", unit: "°C", word: "temperature" },
  h: { sensorType: "humidity", unit: "%", word: "humidity" },
  p: { sensorType: "pressure", unit: "hPa", word: "pressure" },
};

/**
 * What each sensor model measures (from the sensors' own data sheets). Used while a device does not
 * say it itself; a device that lists `reads` for a part is followed instead.
 */
const MODEL_READS: Record<string, Reading[]> = {
  DS18B20: ["t"],
  DHT22: ["t", "h"],
  BME280: ["t", "h", "p"],
  BMP280: ["t", "p"],
  SHT3X: ["t", "h"],
  SHT4X: ["t", "h"],
  AHT20: ["t", "h"],
};

export type ItemPlan =
  | { kind: "relay"; slug: string; name: string; partId: number }
  | { kind: "sensor"; slug: string; name: string; partId: number; reading: Reading; sensorType: string; unit: string };

export const relaySlug = (partId: number) => `relay_${partId}`;
export const sensorSlug = (partId: number, reading: Reading) => `sensor_${partId}_${reading}`;

function readsOf(part: DeviceInfo["parts"][number]): Reading[] {
  if (Array.isArray(part.reads)) return part.reads.filter((r): r is Reading => r === "t" || r === "h" || r === "p");
  return MODEL_READS[(part.model ?? "").toUpperCase()] ?? [];
}

/** The items Nexternel keeps for this device (buttons and displays are not items yet). */
export function planItems(info: DeviceInfo): ItemPlan[] {
  const out: ItemPlan[] = [];
  for (const part of info.parts ?? []) {
    if (!Number.isInteger(part.id)) continue;
    const name = (part.name ?? "").trim() || `${part.type} ${part.id}`;
    if (part.type === "relay") out.push({ kind: "relay", slug: relaySlug(part.id), name, partId: part.id });
    if (part.type === "sensor") {
      const reads = readsOf(part);
      for (const r of reads) {
        const m = READING[r];
        // One reading: the sensor's own name. More: its name and what is read ("Shed temperature").
        const itemName = reads.length === 1 ? name : `${name} ${m.word}`;
        out.push({ kind: "sensor", slug: sensorSlug(part.id, r), name: itemName, partId: part.id, reading: r, sensorType: m.sensorType, unit: m.unit });
      }
    }
  }
  return out;
}

/** Nexternel's items of one device, by slug: the item (capability) id and what it is. */
export type ItemMap = Map<string, { itemId: string; kind: string }>;

export type ItemReport = { itemId: string; value: unknown; kind: string; slug: string };

/**
 * What a status says, item by item. A sensor that is listed without a reading it normally takes
 * could not read: that reading is reported as "nan" (no value, the sensor is not answering).
 */
export function readStatus(status: DeviceStatus, items: ItemMap): ItemReport[] {
  const out: ItemReport[] = [];
  for (const r of status.relays ?? []) {
    const item = items.get(relaySlug(r.id));
    if (item && typeof r.on === "boolean") out.push({ itemId: item.itemId, value: r.on, kind: item.kind, slug: relaySlug(r.id) });
  }
  for (const s of status.sensors ?? []) {
    for (const reading of ["t", "h", "p"] as const) {
      const slug = sensorSlug(s.id, reading);
      const item = items.get(slug);
      if (!item) continue;
      const v = s[reading];
      out.push({ itemId: item.itemId, value: typeof v === "number" && Number.isFinite(v) ? v : "nan", kind: item.kind, slug });
    }
  }
  return out;
}
