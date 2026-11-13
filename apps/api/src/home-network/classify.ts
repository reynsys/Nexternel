/**
 * Home network search: turns what devices said about themselves (from the local-name service)
 * into one line per physical device, grouped by what bringing it into Nexternel takes.
 * Pure: no network, no database — the route passes in what Nexternel already has.
 */

import type { FoundDevice, FoundDeviceKind } from "@nexternel/domain";

export type { FoundDevice };
type FoundKind = FoundDeviceKind;

export type RawService = {
  type: string; // e.g. "_esphomelib._tcp"
  instance: string;
  host: string | null;
  port: number | null;
  address: string | null;
  txt: Record<string, string>;
  seenSecondsAgo: number;
};

export type RawCamera = {
  address: string;
  xaddrs: string[];
  scopes: string[];
  seenSecondsAgo: number;
};

export type RawSearch = { services: RawService[]; cameras: RawCamera[] };

export type KnownDevice = {
  id: string;
  name: string;
  firmwareType: string | null;
  esphomeName: string | null;
  mqttTopicPrefix: string | null;
  ipAddress: string | null;
  macAddress: string | null;
};

export type KnownCamera = { id: string; name: string; host: string | null };

const KIND_ORDER: Record<FoundKind, number> = {
  board: 0,
  shelly: 1,
  matterNew: 2,
  camera: 3,
  matterShared: 4,
  other: 5,
};

/** "ecfabc6305c1" / "EC:FA:BC:63:05:C1" → "ec:fa:bc:63:05:c1"; anything else → null. */
export function normaliseMac(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hex = raw.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(":");
}

/** "shelly1minig3-cc8da25b0074" → { model: "shelly1minig3", mac: "cc:8d:a2:5b:00:74" } */
function splitShellyId(id: string): { model: string; macSuffix: string } {
  const m = /^(.*?)-([0-9a-f]{6,12})$/i.exec(id);
  return m ? { model: m[1], macSuffix: m[2].toLowerCase() } : { model: id, macSuffix: "" };
}

const SHELLY_NAMES: Array<[RegExp, string]> = [
  [/^shelly1minig4/i, "Shelly 1 Mini Gen 4"],
  [/^shelly1minig3/i, "Shelly 1 Mini Gen 3"],
  [/^shelly1pmminig3/i, "Shelly 1PM Mini Gen 3"],
  [/^shellyplus1pm/i, "Shelly Plus 1PM"],
  [/^shellyplus1/i, "Shelly Plus 1"],
  [/^shellyplus2pm/i, "Shelly Plus 2PM"],
  [/^shellyplusplugs/i, "Shelly Plus Plug S"],
  [/^shelly1pm/i, "Shelly 1PM"],
  [/^shelly1l/i, "Shelly 1L"],
  [/^shelly1/i, "Shelly 1"],
  [/^shelly25/i, "Shelly 2.5"],
  [/^shellyplug/i, "Shelly Plug"],
  [/^shellydimmer/i, "Shelly Dimmer"],
  [/^shellyrgbw/i, "Shelly RGBW"],
  [/^shellypro/i, "Shelly Pro"],
];

export function shellyModelName(id: string): string {
  const hit = SHELLY_NAMES.find(([re]) => re.test(id));
  return hit ? hit[1] : "Shelly switch";
}

type Candidate = Omit<FoundDevice, "key" | "alreadyIn">;

function blank(kind: FoundKind, name: string, what: string, address: string | null): Candidate {
  return { kind, name, what, address, mac: null, deviceId: null, shellyGen: null, readyMade: false, board: null, version: null };
}

/** One service → what it tells us about its device, or null when it says nothing useful. */
function fromService(s: RawService): Candidate | null {
  const t = s.txt ?? {};
  switch (s.type) {
    case "_esphomelib._tcp": {
      const platform = (t.platform || "").toUpperCase();
      const c = blank("board", t.friendly_name || s.instance, platform ? `ESPHome board · ${platform}` : "ESPHome board", s.address);
      c.mac = normaliseMac(t.mac);
      c.deviceId = s.instance.toLowerCase();
      c.version = t.version || null;
      c.board = t.board || null;
      c.readyMade = Boolean(t.package_import_url || t.project_name);
      return c;
    }
    case "_shelly._tcp": {
      const { macSuffix } = splitShellyId(s.instance);
      const c = blank("shelly", shellyModelName(s.instance), shellyModelName(s.instance), s.address);
      c.mac = normaliseMac(macSuffix);
      c.deviceId = s.instance.toLowerCase();
      c.shellyGen = Number(t.gen) || 2;
      return c;
    }
    case "_http._tcp": {
      // Original (Gen 1) Shelly switches only say "shelly…" here; other web pages are ignored.
      if (!/^shelly/i.test(s.instance)) return null;
      const id = t.id || s.instance;
      const { macSuffix } = splitShellyId(id);
      const c = blank("shelly", shellyModelName(id), shellyModelName(id), s.address);
      c.mac = normaliseMac(macSuffix);
      c.deviceId = id.toLowerCase();
      c.shellyGen = Number(t.gen) || 1;
      return c;
    }
    case "_matterc._udp":
      return blank("matterNew", t.dn || "Matter device", "Matter · waiting to be added", s.address);
    case "_matter._tcp":
      return blank("matterShared", "Matter device", "Matter · used by another app", s.address);
    case "_googlecast._tcp":
      return blank("other", t.fn || s.instance, t.md || "TV or speaker", s.address);
    case "_airplay._tcp":
      return blank("other", s.instance, [t.manufacturer, t.model].filter(Boolean).join(" ") || "TV or speaker", s.address);
    case "_amzn-wplay._tcp":
      return blank("other", t.n || "Amazon device", "Amazon Echo or Fire TV", s.address);
    case "_hap._tcp":
      return blank("other", s.instance, t.md || "Apple Home accessory", s.address);
    case "_hue._tcp":
      return blank("other", s.instance, "Philips Hue Bridge", s.address);
    case "_ewelink._tcp":
      return blank("other", s.instance, "Sonoff switch", s.address);
    case "_rtsp._tcp":
      return blank("camera", s.instance, "Camera", s.address);
    default:
      return null;
  }
}

function scopeValue(scopes: string[], key: string): string | null {
  const prefix = `onvif://www.onvif.org/${key}/`;
  const hit = scopes.find((s) => s.toLowerCase().startsWith(prefix));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(prefix.length)).replace(/_/g, " ").trim() || null;
  } catch {
    return hit.slice(prefix.length);
  }
}

function fromCamera(c: RawCamera): Candidate {
  const name = scopeValue(c.scopes, "name");
  const hardware = scopeValue(c.scopes, "hardware");
  return blank("camera", name || hardware || "Camera", hardware ? `Camera · ${hardware}` : "Camera", c.address);
}

/** Merge what several services say about the same device (same address). */
function merge(list: Candidate[]): Candidate {
  const sorted = [...list].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  let best = { ...sorted[0] };
  // A TV or speaker that also speaks Matter is usually acting as a hub for other Matter devices,
  // not something to control: keep it as what it is and say it speaks Matter.
  const other = list.find((c) => c.kind === "other");
  if (best.kind === "matterShared" && other) {
    best = { ...other, what: `${other.what} · Matter` };
  }
  for (const c of sorted) {
    best.mac ??= c.mac;
    best.version ??= c.version;
  }
  return best;
}

function hostOfUrl(raw: string | null): string | null {
  return raw ? raw.trim().toLowerCase() || null : null;
}

/** Is this found device one Nexternel already has? */
function matchKnown(
  c: Candidate,
  devices: KnownDevice[],
  cameras: KnownCamera[]
): FoundDevice["alreadyIn"] {
  if (c.kind === "camera") {
    const cam = cameras.find((k) => c.address && hostOfUrl(k.host) === c.address);
    if (cam) return { kind: "camera", id: cam.id, name: cam.name };
  }
  const id = c.deviceId?.toLowerCase() ?? null;
  for (const d of devices) {
    const mac = normaliseMac(d.macAddress);
    if (c.mac && mac && mac === c.mac) return { kind: "device", id: d.id, name: d.name };
    if (c.kind === "board" && id && d.esphomeName?.toLowerCase() === id) return { kind: "device", id: d.id, name: d.name };
    if (c.kind === "shelly" && id) {
      const prefix = (d.mqttTopicPrefix || "").toLowerCase();
      if (prefix === id || prefix.endsWith(`/${id}`)) return { kind: "device", id: d.id, name: d.name };
      // A Shelly's id ends with (part of) its MAC address.
      const tail = splitShellyId(id).macSuffix;
      if (mac && tail.length >= 6 && mac.replace(/:/g, "").endsWith(tail)) return { kind: "device", id: d.id, name: d.name };
    }
    const ip = d.ipAddress?.replace(/\/32$/, "") ?? null;
    if (c.kind === "board" && c.address && ip === c.address && (d.firmwareType || "esphome") === "esphome") {
      return { kind: "device", id: d.id, name: d.name };
    }
  }
  return null;
}

export function classifySearch(
  raw: RawSearch,
  known: { devices: KnownDevice[]; cameras: KnownCamera[] }
): FoundDevice[] {
  const byAddress = new Map<string, Candidate[]>();
  const noAddress: Candidate[] = [];
  const add = (c: Candidate | null) => {
    if (!c) return;
    if (c.address) {
      const list = byAddress.get(c.address) ?? [];
      list.push(c);
      byAddress.set(c.address, list);
    } else {
      noAddress.push(c);
    }
  };
  for (const s of raw.services ?? []) add(fromService(s));
  for (const c of raw.cameras ?? []) add(fromCamera(c));

  const merged = [...[...byAddress.values()].map(merge), ...noAddress];
  return merged
    .map((c) => ({
      ...c,
      key: `${c.kind}:${c.mac ?? c.deviceId ?? c.address ?? c.name}`,
      alreadyIn: matchKnown(c, known.devices, known.cameras),
    }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
}
