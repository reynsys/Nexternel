import { mkdir, readFile, rename, writeFile } from "fs/promises";
import tls from "tls";
import dns from "dns";
import { readFileSync } from "fs";
import { licenceTokenFor } from "../addons/service.js";
import path from "path";
import QRCode from "qrcode";

/**
 * Nexternel Anywhere: reaching this home from outside through Reynsys' door, with no router changes.
 * The home link (service "door-link") calls out to the door and brings visitors in to Caddy's
 * outside entrance (see https.ts), where the padlock for <name>.nexternel.net ends, at home.
 *
 * The settings live in one file shared with the home link: Nexternel writes it, the link reads it.
 * The link writes its state (connecting, open, refused …) next to it.
 */

function anywhereDir(): string {
  return process.env.ANYWHERE_DIR || "/anywhere";
}

const SETTINGS_FILE = () => path.join(anywhereDir(), "anywhere.json");
const STATUS_FILE = () => path.join(anywhereDir(), "status.json");

export const DEFAULT_DOOR_DOMAIN = "nexternel.net";
/** Inside port of Caddy's outside entrance. Only the home link reaches it; it is not opened on the server. */
export const OUTSIDE_ENTRANCE_PORT = 8443;

export type AnywhereSettings = {
  enabled: boolean;
  /** The home's chosen name: <name>.nexternel.net. */
  name: string | null;
  /** The home's door key (secret; the door only keeps its fingerprint). */
  key: string | null;
  doorDomain: string;
  /** This home's GPS port at the door, kept so it can be asked for again if the door ever loses it. */
  gpsPort?: number | null;
};

export type AnywhereStatus = {
  state: "starting" | "off" | "connecting" | "open" | "refused";
  since: number;
  address: string | null;
  gpsPort: number | null;
  error: string | null;
  /** Last sign of life from the link (written every 30 s). */
  seen?: number;
  /** The name the link is using (null when off). */
  name?: string | null;
};

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const DOMAIN_RE = /^(?=.{1,200}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function validAnywhereName(name: string): boolean {
  return NAME_RE.test(name);
}

export async function readAnywhereSettings(): Promise<AnywhereSettings> {
  try {
    const raw = JSON.parse(await readFile(SETTINGS_FILE(), "utf8")) as Partial<AnywhereSettings>;
    const name = typeof raw.name === "string" && NAME_RE.test(raw.name) ? raw.name : null;
    const key = typeof raw.key === "string" && raw.key.length >= 32 ? raw.key : null;
    const doorDomain =
      typeof raw.doorDomain === "string" && DOMAIN_RE.test(raw.doorDomain.toLowerCase())
        ? raw.doorDomain.toLowerCase()
        : DEFAULT_DOOR_DOMAIN;
    const gpsPort = Number.isInteger(raw.gpsPort) && Number(raw.gpsPort) > 1024 ? Number(raw.gpsPort) : null;
    return { enabled: raw.enabled === true, name, key, doorDomain, gpsPort };
  } catch {
    return { enabled: false, name: null, key: null, doorDomain: DEFAULT_DOOR_DOMAIN };
  }
}

/** The outside address (without https://) when Nexternel Anywhere is switched on and set up. */
export function anywhereAddress(settings: AnywhereSettings): string | null {
  if (!settings.enabled || !settings.name || !settings.key) return null;
  return `${settings.name}.${settings.doorDomain}`;
}

export async function readAnywhereStatus(): Promise<AnywhereStatus | null> {
  try {
    return JSON.parse(await readFile(STATUS_FILE(), "utf8")) as AnywhereStatus;
  } catch {
    return null;
  }
}

export async function writeAnywhereSettings(settings: AnywhereSettings): Promise<void> {
  await mkdir(anywhereDir(), { recursive: true });
  const tmp = SETTINGS_FILE() + ".tmp";
  await writeFile(tmp, JSON.stringify(settings, null, 1), { mode: 0o600 });
  await rename(tmp, SETTINGS_FILE());
}

/**
 * The padlock as a phone sees it: a secure connection to the outside entrance for the address,
 * checked against the certificates every phone trusts. Only a padlock that passes counts.
 */
export function outsideCertificate(address: string): Promise<{ validTo: string } | null> {
  const host = process.env.ANYWHERE_ENTRANCE_HOST || "caddy";
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: OUTSIDE_ENTRANCE_PORT, servername: address, timeout: 5_000 });
    const done = (v: { validTo: string } | null) => {
      sock.destroy();
      resolve(v);
    };
    sock.once("secureConnect", () => {
      const cert = sock.getPeerCertificate();
      done(sock.authorized && cert?.valid_to ? { validTo: new Date(cert.valid_to).toISOString() } : null);
    });
    sock.once("error", () => done(null));
    sock.once("timeout", () => done(null));
  });
}

/** What the Settings card shows. The light is worked out here so every screen says the same. */
export type AnywhereView = {
  /** This server has a licence that includes Nexternel Anywhere. */
  licensed: boolean;
  /** A name and key are set (chosen with Nexternel Anywhere). */
  setUp: boolean;
  name: string | null;
  /** ".nexternel.net": shown after the name box. */
  domain: string;
  enabled: boolean;
  /** https://<name>.nexternel.net */
  address: string | null;
  light: "off" | "green" | "orange" | "red";
  /** One plain line next to the light. */
  text: string;
  certificateValidTo: string | null;
  /** QR code of the address, for the phone's camera (SVG). */
  qrSvg: string | null;
  /** Where GPS trackers send their positions (this home's own door number), when open. */
  gps: { host: string; ip: string | null; port: number } | null;
};

const LINK_SILENT_MS = 90_000; // the link writes its state every 30 s
const CONNECT_GRACE_MS = 2 * 60_000;
const CERT_GRACE_MS = 10 * 60_000;

export function anywhereLight(
  settings: AnywhereSettings,
  status: AnywhereStatus | null,
  hasCertificate: boolean,
  now = Date.now()
): Pick<AnywhereView, "light" | "text"> {
  if (!settings.name || !settings.key) return { light: "off", text: "Not set up yet." };
  if (!settings.enabled) return { light: "off", text: "Off. Nexternel can only be opened at home." };
  const alive = status && typeof status.seen === "number" && now - status.seen < LINK_SILENT_MS;
  if (!alive) {
    return { light: "red", text: "Nexternel Anywhere is not running on this server. Try Restart under Help & troubleshooting." };
  }
  // Just switched on or given a new name: the link has not caught up yet.
  if (status.name !== settings.name) return { light: "orange", text: "Connecting…" };
  if (status.state === "refused") {
    return status.error === "licence ended"
      ? { light: "red", text: "Your Nexternel Anywhere licence has ended. Once it is renewed, it opens again by itself." }
      : { light: "red", text: "Nexternel Anywhere did not accept this home's key. Nexternel sets it up again by itself within a few minutes." };
  }
  if (status.state !== "open") {
    return now - status.since > CONNECT_GRACE_MS
      ? { light: "red", text: "Cannot reach Nexternel Anywhere. Check that this home's internet is working." }
      : { light: "orange", text: "Connecting…" };
  }
  if (!hasCertificate) {
    return now - status.since > CERT_GRACE_MS
      ? { light: "red", text: "The padlock for your address could not be got yet. Nexternel keeps trying." }
      : { light: "orange", text: "Getting the padlock for your address… (about a minute)" };
  }
  return { light: "green", text: "Open from anywhere." };
}

/** The door's IPv4 address: many trackers only take a number, not a name. Looked up once an hour. */
let doorIp: { host: string; ip: string | null; at: number } | null = null;
async function doorIpv4(host: string): Promise<string | null> {
  if (doorIp && doorIp.host === host && Date.now() - doorIp.at < 3_600_000) return doorIp.ip;
  let ip: string | null = null;
  try {
    ip = (await dns.promises.lookup(host, { family: 4 })).address;
  } catch {
    ip = null;
  }
  doorIp = { host, ip, at: Date.now() };
  return ip;
}

export async function anywhereView(): Promise<AnywhereView> {
  const settings = await readAnywhereSettings();
  const status = await readAnywhereStatus();
  const setUp = Boolean(settings.name && settings.key);
  const host = setUp ? `${settings.name}.${settings.doorDomain}` : null;
  const cert = host ? await outsideCertificate(host) : null;
  const address = host ? `https://${host}` : null;
  return {
    licensed: Boolean(await licenceTokenFor("anywhere")),
    setUp,
    name: settings.name,
    domain: `.${settings.doorDomain}`,
    enabled: settings.enabled && setUp,
    address,
    ...anywhereLight(settings, status, Boolean(cert)),
    certificateValidTo: cert?.validTo ?? null,
    qrSvg: address ? await QRCode.toString(address, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null,
    gps: await gpsTarget(settings, status),
  };
}

async function gpsTarget(settings: AnywhereSettings, status: AnywhereStatus | null): Promise<AnywhereView["gps"]> {
  if (!settings.enabled || !settings.name || !settings.key) return null;
  if (!status || status.state !== "open" || status.name !== settings.name) return null;
  if (typeof status.gpsPort !== "number" || !status.gpsPort) return null;
  const host = process.env.ANYWHERE_DOOR_HOST || `door.${settings.doorDomain}`;
  return { host, ip: await doorIpv4(host), port: status.gpsPort };
}

// ---------- The name office (on the door server) ----------

export class AnywhereError extends Error {}

/** One request to the name office, one answer. */
function askDoor(doorDomain: string, msg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const doorHost = process.env.ANYWHERE_DOOR_HOST || `door.${doorDomain}`;
  const caFile = process.env.ANYWHERE_DOOR_CA; // only for testing
  return new Promise((resolve, reject) => {
    const sock = tls.connect({
      host: process.env.ANYWHERE_DOOR_CONNECT || doorHost, // only for testing: where to dial
      port: Number(process.env.ANYWHERE_DOOR_PORT || 7443),
      servername: doorHost,
      ca: caFile ? readFileSync(caFile) : undefined,
      minVersion: "TLSv1.2",
      timeout: 15_000,
    });
    let buf = "";
    const fail = () => {
      sock.destroy();
      reject(new AnywhereError("Nexternel Anywhere could not be reached. Check this server's internet connection and try again."));
    };
    sock.once("secureConnect", () => sock.write(JSON.stringify(msg) + "\n"));
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      const i = buf.indexOf("\n");
      if (i < 0) return buf.length > 16_384 ? fail() : undefined;
      sock.destroy();
      try {
        resolve(JSON.parse(buf.slice(0, i)) as Record<string, unknown>);
      } catch {
        fail();
      }
    });
    sock.once("error", fail);
    sock.once("timeout", fail);
  });
}

export type NameCheck = { name: string; free: boolean; problem: string | null; suggestions: string[] };

export async function checkAnywhereName(raw: string): Promise<NameCheck> {
  const name = raw.trim().toLowerCase();
  const settings = await readAnywhereSettings();
  if (name === settings.name) return { name, free: true, problem: null, suggestions: [] };
  const r = await askDoor(settings.doorDomain, { check: name });
  return {
    name,
    free: r.free === true,
    problem: typeof r.problem === "string" ? r.problem : typeof r.refused === "string" ? r.refused : null,
    suggestions: Array.isArray(r.suggestions) ? r.suggestions.filter((x): x is string => typeof x === "string") : [],
  };
}

/** Take a name (first time, or a new one: the old one is given up). Switches Nexternel Anywhere on. */
export async function claimAnywhereName(raw: string): Promise<string> {
  const name = raw.trim().toLowerCase();
  const licence = await licenceTokenFor("anywhere");
  if (!licence) throw new AnywhereError("This server has no Nexternel Anywhere licence.");
  const settings = await readAnywhereSettings();
  // Ask for this home's old GPS port back, so trackers keep working if the door has to set it up again.
  const status = await readAnywhereStatus();
  const gpsPort = typeof status?.gpsPort === "number" ? status.gpsPort : settings.gpsPort ?? undefined;
  const r = await askDoor(settings.doorDomain, { claim: name, licence, ...(gpsPort ? { gpsPort } : {}) });
  if (typeof r.claimed !== "string" || typeof r.key !== "string") {
    const extra = Array.isArray(r.suggestions) && r.suggestions.length ? ` Free: ${r.suggestions.join(", ")}.` : "";
    throw new AnywhereError(`${typeof r.refused === "string" ? r.refused : "The name could not be taken."}${extra}`);
  }
  const newPort = Number.isInteger(r.gpsPort) ? Number(r.gpsPort) : gpsPort ?? null;
  await writeAnywhereSettings({ ...settings, enabled: true, name: r.claimed, key: r.key, gpsPort: newPort });
  return r.claimed;
}

/** Pass the renewed licence to the door, so a paid-up home keeps being let in. Quiet when it fails. */
export async function renewAnywhere(): Promise<void> {
  const settings = await readAnywhereSettings();
  if (!settings.name || !settings.key) return;
  const licence = await licenceTokenFor("anywhere");
  if (!licence) return;
  await askDoor(settings.doorDomain, { renew: settings.name, key: settings.key, licence }).catch(() => undefined);
}

/**
 * Wait (up to a short while) until the home link is through to the door under this name. The
 * padlock is asked for only then: the certificate office checks the address through the door at
 * once, and failed checks count against a limit.
 */
export async function waitForLink(name: string, ms = 20_000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const st = await readAnywhereStatus();
    if (st?.state === "open" && st.name === name) return true;
    if (st?.state === "refused" && st.name === name) return false;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/**
 * Self-repair: if the door no longer knows this home (it lost its list, or the key was replaced by
 * an older backup), take the same name again with this home's licence. The door gives a name back
 * only to the licence that held it, so nobody else can get a name this way. At most once in 30 min.
 */
let lastRepair = 0;
/** Note down this home's GPS port from the link, so it can be asked for again (see claimAnywhereName). */
export async function rememberGpsPort(): Promise<void> {
  const settings = await readAnywhereSettings();
  const st = await readAnywhereStatus();
  if (!settings.name || st?.state !== "open" || st.name !== settings.name) return;
  if (typeof st.gpsPort !== "number" || st.gpsPort === settings.gpsPort) return;
  await writeAnywhereSettings({ ...settings, gpsPort: st.gpsPort });
}

export async function repairAnywhere(now = Date.now()): Promise<boolean> {
  const settings = await readAnywhereSettings();
  if (!settings.enabled || !settings.name || !settings.key) return false;
  const st = await readAnywhereStatus();
  if (st?.state !== "refused" || st.error !== "unknown home or wrong key" || st.name !== settings.name) return false;
  if (now - lastRepair < 30 * 60_000) return false;
  lastRepair = now;
  try {
    await claimAnywhereName(settings.name);
    return true;
  } catch {
    return false; // e.g. the name now belongs to another licence: the card shows it
  }
}

let renewTimer: NodeJS.Timeout | null = null;
/** Renewal a few minutes after start (after the licence check) and then every day; repair checks every 5 minutes. */
export function startAnywhereRenewal(): void {
  if (renewTimer) return;
  const run = () => void renewAnywhere().catch(() => undefined);
  setTimeout(run, 5 * 60_000);
  renewTimer = setInterval(run, 24 * 60 * 60 * 1000);
  setInterval(() => {
    void rememberGpsPort()
      .catch(() => undefined)
      .then(() => repairAnywhere())
      .catch(() => undefined);
  }, 5 * 60_000).unref();
}
