/**
 * A Zherodius device's parts (Zh.GetInfo) as Nexternel items: each relay is a switch, and each sensor
 * gives one item per reading it takes (temperature, humidity, pressure, CO2; an electricity meter: power now
 * and kWh so far; dust, light level, motion, presence and more from Zherodius 2.5.1).
 * Since Zherodius 2.5.1 the device says what each reading is (GetInfo "measures": unit, word, type), so a new
 * kind of reading needs no change here; the six below are for devices that do not say it yet.
 * From Zherodius 2.7.1 a light is a light control (on, brightness, and colour for WS2812B LEDs; the board's status light
 * is not an item), and a buzzer is a switch: on = it sounds for its own set time, then it reports off by itself.
 */
import type { DeviceInfo, DeviceStatus } from "./line.js";

/** A reading's key on the line: t h p c w e, and from Zherodius 2.5.1 also longer ones (pm25, lux, motion …). */
export type Reading = string;

const READING: Record<string, { sensorType: string; unit: string; word: string }> = {
  t: { sensorType: "temperature", unit: "°C", word: "temperature" },
  h: { sensorType: "humidity", unit: "%", word: "humidity" },
  p: { sensorType: "pressure", unit: "hPa", word: "pressure" },
  c: { sensorType: "co2", unit: "ppm", word: "CO2" },
  w: { sensorType: "power", unit: "W", word: "power" },
  e: { sensorType: "energy", unit: "kWh", word: "energy" },
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
  SCD4X: ["c", "t", "h"],
};

export type ItemPlan =
  | { kind: "relay"; slug: string; name: string; partId: number }
  | { kind: "control"; slug: string; name: string; partId: number; controlType: "light"; features: { brightness: true; color: boolean } }
  | { kind: "sensor"; slug: string; name: string; partId: number; reading: Reading; sensorType: string; unit: string };

export const relaySlug = (partId: number) => `relay_${partId}`;
export const contactSlug = (partId: number) => `contact_${partId}`;
export const lightSlug = (partId: number) => `light_${partId}`;
export const buzzerSlug = (partId: number) => `buzzer_${partId}`;

/** A colour as Zherodius sends it (red, green, blue 0-255, at full brightness) as Nexternel's hue (0-360) and saturation (0-1). */
export function rgbToHs(rgb: unknown): { h: number; s: number } | undefined {
  if (!Array.isArray(rgb) || rgb.length !== 3 || !rgb.every((v) => typeof v === "number" && Number.isFinite(v))) return undefined;
  const [r, g, b] = (rgb as number[]).map((v) => Math.min(255, Math.max(0, v)) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (max === 0) return { h: 0, s: 0 };
  let h = 0;
  if (d > 0) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(((h * 60) + 360) % 360), s: Math.round((d / max) * 1000) / 1000 };
}

/** Nexternel's hue and saturation as the colour Zherodius takes (at full brightness: brightness is sent apart). */
export function hsToRgb(c: { h: number; s: number }): [number, number, number] {
  const h = ((c.h % 360) + 360) % 360, s = Math.min(1, Math.max(0, c.s));
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => 1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}
export const sensorSlug = (partId: number, reading: Reading) => `sensor_${partId}_${reading}`;

/** What a reading is: the device's own words (Zherodius 2.5.1+), else the table above; undefined = not known. */
function measureOf(info: DeviceInfo, r: string): { sensorType: string; unit: string; word: string } | undefined {
  const m = info.measures?.[r];
  if (m && typeof m.type === "string" && m.type && typeof m.word === "string" && m.word)
    return { sensorType: m.type, unit: typeof m.unit === "string" ? m.unit : "", word: m.word };
  return READING[r];
}

const SAFE_KEY = /^[a-z0-9]{1,12}$/;

function readsOf(info: DeviceInfo, part: DeviceInfo["parts"][number]): Reading[] {
  if (Array.isArray(part.reads)) return part.reads.filter((r): r is string => typeof r === "string" && SAFE_KEY.test(r) && !!measureOf(info, r));
  return MODEL_READS[(part.model ?? "").toUpperCase()] ?? [];
}

/** The items Nexternel keeps for this device (push buttons and displays are not items). */
export function planItems(info: DeviceInfo): ItemPlan[] {
  const out: ItemPlan[] = [];
  for (const part of info.parts ?? []) {
    if (!Number.isInteger(part.id)) continue;
    const name = (part.name ?? "").trim() || `${part.type} ${part.id}`;
    if (part.type === "relay") out.push({ kind: "relay", slug: relaySlug(part.id), name, partId: part.id });
    if (part.type === "light" && (part.kind === "dimmable" || part.kind === "colour"))
      out.push({ kind: "control", slug: lightSlug(part.id), name, partId: part.id, controlType: "light", features: { brightness: true, color: part.kind === "colour" } });
    if (part.type === "buzzer") out.push({ kind: "relay", slug: buzzerSlug(part.id), name, partId: part.id });
    // a wired switch or contact (door, window …): Nexternel's Contact item, true = open; push buttons are not items
    if (part.type === "button" && part.kind === "contact")
      out.push({ kind: "sensor", slug: contactSlug(part.id), name, partId: part.id, reading: "open", sensorType: "door", unit: "" });
    if (part.type === "sensor") {
      const reads = readsOf(info, part);
      for (const r of reads) {
        const m = measureOf(info, r)!;
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

/** control = a light's state ({ on, brightness, color }), reported as a device control. */
export type ItemReport = { itemId: string; value: unknown; kind: string; slug: string; control?: boolean };

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
  for (const l of status.lights ?? []) {
    const item = items.get(lightSlug(l.id));
    if (!item || typeof l.on !== "boolean") continue;
    const value: Record<string, unknown> = { on: l.on };
    if (typeof l.level === "number") value.brightness = l.level;
    const color = rgbToHs(l.rgb);
    if (color) value.color = color;
    out.push({ itemId: item.itemId, value, kind: item.kind, slug: lightSlug(l.id), control: true });
  }
  for (const z of status.buzzers ?? []) {
    const item = items.get(buzzerSlug(z.id));
    if (item && typeof z.on === "boolean") out.push({ itemId: item.itemId, value: z.on, kind: item.kind, slug: buzzerSlug(z.id) });
  }
  for (const b of status.buttons ?? []) {
    const item = items.get(contactSlug(b.id));
    if (item && typeof b.pressed === "boolean") out.push({ itemId: item.itemId, value: !b.pressed, kind: item.kind, slug: contactSlug(b.id) });
  }
  // every reading item Nexternel keeps for each sensor; one the status does not carry could not be read
  const bySensor = new Map<number, { reading: string; slug: string; item: { itemId: string; kind: string } }[]>();
  for (const [slug, item] of items) {
    const m = /^sensor_(\d+)_([a-z0-9]+)$/.exec(slug);
    if (!m) continue;
    const id = Number(m[1]);
    if (!bySensor.has(id)) bySensor.set(id, []);
    bySensor.get(id)!.push({ reading: m[2], slug, item });
  }
  for (const s of status.sensors ?? []) {
    for (const { reading, slug, item } of bySensor.get(s.id) ?? []) {
      const v = (s as Record<string, unknown>)[reading];
      const value = typeof v === "number" && Number.isFinite(v) ? v : typeof v === "boolean" ? v : "nan";
      out.push({ itemId: item.itemId, value, kind: item.kind, slug });
    }
  }
  return out;
}
