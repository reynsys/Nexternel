import { execFile } from "child_process";
import { createPrivateKey, X509Certificate } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { anywhereAddress, OUTSIDE_ENTRANCE_PORT, readAnywhereSettings } from "./anywhere.js";
import { detectedHostIp } from "./host-ip.js";
import { ENTRANCE_HEADER } from "../auth/login-guard.js";

/**
 * Secure connection (https). Caddy (service "caddy") is Nexternel's front door: it encrypts
 * every connection with Nexternel's own home certificate, and with the owner's certificate
 * when they use their own domain. This module writes Caddy's configuration and reloads it.
 */
const execFileAsync = promisify(execFile);
const CADDY_CONTAINER = "nexternel-caddy";

function caddyDir(): string {
  return process.env.CADDY_DIR || "/caddy";
}

function caddyDataDir(): string {
  return process.env.CADDY_DATA_DIR || "/caddy-data";
}

const ROOT_CERT = () => path.join(caddyDataDir(), "caddy/pki/authorities/local/root.crt");
const SETTINGS_FILE = () => path.join(caddyDir(), "nexternel-https.json");
export const CERT_DOWNLOAD_PATH = "/nexternel-home-certificate.crt";

export type HttpsSettings = {
  /** Off = plain http on every port, as before V5.2.88. */
  enabled: boolean;
  /** More names this server is reached by (e.g. its computer name). */
  extraNames: string[];
  /** The owner's own domain, served with their uploaded certificate. */
  domain: string | null;
};

const DEFAULTS: HttpsSettings = { enabled: true, extraNames: [], domain: null };
const NAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function validName(name: string): boolean {
  return IPV4_RE.test(name) || NAME_RE.test(name);
}

export async function readHttpsSettings(): Promise<HttpsSettings> {
  try {
    const raw = JSON.parse(await readFile(SETTINGS_FILE(), "utf8")) as Partial<HttpsSettings>;
    return {
      enabled: raw.enabled !== false,
      extraNames: Array.isArray(raw.extraNames) ? raw.extraNames.filter((n) => typeof n === "string" && validName(n)) : [],
      domain: typeof raw.domain === "string" && NAME_RE.test(raw.domain) ? raw.domain.toLowerCase() : null,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function ports() {
  return {
    https: Number(process.env.HTTPS_PORT || 443) || 443,
  };
}

/** Names the home certificate covers: the server's address, nexternel.local, localhost, and extras. */
export function homeNames(settings: HttpsSettings, serverIp: string | null): string[] {
  const names = [serverIp, "nexternel.local", "localhost", ...settings.extraNames].filter(
    (n): n is string => Boolean(n && validName(n))
  );
  return [...new Set(names.map((n) => n.toLowerCase()))];
}

/**
 * The ESPHome page: only through Caddy, and only with the pass Nexternel's "Open in ESPHome" gives
 * (esphome/gate.ts). ESPHome itself listens on a socket only Caddy can reach.
 */
export const ESPHOME_SITE = [
  "# ESPHome: opened from Nexternel only (Devices → Open in ESPHome).",
  "http://:6052 {",
  "\tforward_auth api:4000 {",
  "\t\turi /api/v1/esphome/gate",
  "\t}",
  "\treverse_proxy unix//run/esphome/dashboard.sock",
  "}",
  "",
];

/**
 * Standard browser-safety headers, added to every page Nexternel serves. They tell the browser not
 * to guess a file's type (nosniff), not to let the dashboard be hidden inside another site
 * (clickjacking: X-Frame-Options and the frame-ancestors rule), to pass on less of the address when
 * leaving (Referrer-Policy), and they drop the server's name. They do not restrict Nexternel's own
 * pages (no full content policy here), so they cannot break the dashboard.
 */
export const SECURITY_HEADERS = [
  "\theader {",
  "\t\tX-Content-Type-Options nosniff",
  "\t\tX-Frame-Options SAMEORIGIN",
  "\t\tReferrer-Policy strict-origin-when-cross-origin",
  "\t\tContent-Security-Policy \"frame-ancestors 'self'\"",
  "\t\t-Server",
  "\t}",
];

/**
 * Nexternel Anywhere's outside entrance. Visitors come through the door and the home link, which
 * first tells Caddy the visitor's real address (PROXY protocol line), so the login guard counts
 * each phone on its own. Every request is marked as coming from outside, so the second check and
 * the outside lock always apply. The padlock is a public certificate for the outside address,
 * which Caddy gets and renews itself (the door passes the certificate check through to home).
 * The port is only inside Nexternel: it is not opened on the server, so only the home link reaches it.
 */
export function outsideEntrance(address: string): string[] {
  return [
    `# Nexternel Anywhere: visitors from outside, through the door (Settings → System → Nexternel Anywhere).`,
    `https://${address}:${OUTSIDE_ENTRANCE_PORT} {`,
    `\trequest_header ${ENTRANCE_HEADER} outside`,
    '\theader Strict-Transport-Security "max-age=31536000"',
    ...SECURITY_HEADERS,
    "\tencode gzip",
    "\treverse_proxy ui:80",
    "}",
    "",
  ];
}

/** Global part for the outside entrance: read the real visitor address the home link sends first. */
const OUTSIDE_SERVER_OPTIONS = [
  `\t# Outside entrance: only the home link connects here (from Nexternel's own network).`,
  `\tservers :${OUTSIDE_ENTRANCE_PORT} {`,
  "\t\tlistener_wrappers {",
  "\t\t\tproxy_protocol {",
  "\t\t\t\ttimeout 5s",
  "\t\t\t\tallow 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 fc00::/7",
  "\t\t\t}",
  "\t\t\ttls",
  "\t\t}",
  "\t}",
];

/** Caddy's configuration (a "Caddyfile") for these settings. */
export function buildCaddyfile(
  settings: HttpsSettings,
  serverIp: string | null,
  hasDomainCert: boolean,
  outside: string | null = null
): string {
  const httpsPort = ports().https;
  const portSuffix = httpsPort === 443 ? "" : `:${httpsPort}`;
  const lines: string[] = [
    "# Written by Nexternel (Settings → System → Secure connection). Changes made here are replaced.",
    "{",
    "\tskip_install_trust",
    "\t# Plain http is answered by the block below (forwarding only once a trusted name exists).",
    "\tauto_https disable_redirects",
  ];
  if (serverIp) lines.push(`\t# Connections made to the bare address name no site; use the server's.`, `\tdefault_sni ${serverIp}`);
  if (outside) lines.push(...OUTSIDE_SERVER_OPTIONS);
  lines.push(
    "\tpki {",
    "\t\tca local {",
    '\t\t\tname "Nexternel Home"',
    '\t\t\troot_cn "Nexternel Home Certificate"',
    "\t\t}",
    "\t}",
    "}",
    ""
  );
  // The home certificate is public (it only lets devices recognise this server), so it is
  // offered over plain http too — needed before a device trusts the secure address.
  const certHandle = [
    `\thandle ${CERT_DOWNLOAD_PATH} {`,
    "\t\troot * /data/caddy/pki/authorities/local",
    "\t\trewrite * /root.crt",
    "\t\theader Content-Type application/x-x509-ca-cert",
    '\t\theader Content-Disposition "attachment; filename=nexternel-home-certificate.crt"',
    "\t\tfile_server",
    "\t}",
  ];
  if (!settings.enabled) {
    // The outside entrance has its own padlock, so it stays open when the home one is off.
    if (outside) lines.push(...outsideEntrance(outside));
    lines.push("http://:80, http://:8080 {", ...certHandle, ...SECURITY_HEADERS, "\thandle {", "\t\treverse_proxy ui:80", "\t}", "}", "", ...ESPHOME_SITE);
    return lines.join("\n");
  }
  const names = homeNames(settings, serverIp);
  lines.push(`${names.map((n) => `https://${n}`).join(", ")} {`, "\ttls internal", "\tencode gzip", ...SECURITY_HEADERS, "\treverse_proxy ui:80", "}", "");
  if (settings.domain && hasDomainCert) {
    lines.push(
      `https://${settings.domain} {`,
      `\ttls /etc/caddy/certs/${settings.domain}.crt /etc/caddy/certs/${settings.domain}.key`,
      "\tencode gzip",
      ...SECURITY_HEADERS,
      "\treverse_proxy ui:80",
      "}",
      ""
    );
  }
  if (outside) lines.push(...outsideEntrance(outside));
  // Plain http stays the normal address: it only forwards once a name with a certificate every
  // device trusts exists. The home certificate is never forced on anyone (it needs installing on
  // each device), but keeps working for those who already trusted it.
  const trusted = settings.domain && hasDomainCert ? settings.domain : null;
  lines.push(
    "http://:80, http://:8080 {",
    ...certHandle,
    ...SECURITY_HEADERS,
    "\thandle {",
    trusted ? `\t\tredir https://${trusted}${portSuffix}{uri} permanent` : "\t\treverse_proxy ui:80",
    "\t}",
    "}",
    "",
    ...ESPHOME_SITE
  );
  return lines.join("\n");
}

function domainCertFiles(domain: string) {
  const dir = path.join(caddyDir(), "certs");
  return { dir, cert: path.join(dir, `${domain}.crt`), key: path.join(dir, `${domain}.key`) };
}

async function readDomainCert(domain: string | null): Promise<X509Certificate | null> {
  if (!domain) return null;
  try {
    return new X509Certificate(await readFile(domainCertFiles(domain).cert));
  } catch {
    return null;
  }
}

async function reloadCaddy(): Promise<string | null> {
  if (process.env.ALLOW_DOCKER_RESTART !== "true") return "Changes are saved and apply when Nexternel restarts.";
  try {
    await execFileAsync(
      "docker",
      ["exec", CADDY_CONTAINER, "caddy", "reload", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"],
      { timeout: 60_000 }
    );
    return null;
  } catch (err) {
    const detail = (err as { stderr?: string }).stderr?.trim().split("\n").pop() ?? (err instanceof Error ? err.message : "");
    return `The secure connection could not be updated (${detail.slice(0, 200)}).`;
  }
}

/** Write Caddy's configuration for the current settings and reload it when it changed. */
export async function applyHttps(force = false): Promise<string | null> {
  const settings = await readHttpsSettings();
  const domainCert = await readDomainCert(settings.domain);
  const outside = anywhereAddress(await readAnywhereSettings());
  const text = buildCaddyfile(settings, detectedHostIp() ?? process.env.SERVER_IP ?? null, Boolean(domainCert), outside);
  const file = path.join(caddyDir(), "Caddyfile");
  let current = "";
  try {
    current = await readFile(file, "utf8");
  } catch {
    /* first time */
  }
  if (current === text && !force) return null;
  await mkdir(caddyDir(), { recursive: true });
  await writeFile(file, text);
  return reloadCaddy();
}

export async function saveHttpsSettings(input: Partial<HttpsSettings>): Promise<{ error: string | null }> {
  const current = await readHttpsSettings();
  const next: HttpsSettings = { ...current };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (Array.isArray(input.extraNames)) {
    const names = input.extraNames.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
    const bad = names.find((n) => !validName(n));
    if (bad) return { error: `"${bad}" is not a valid name or address.` };
    next.extraNames = [...new Set(names)].slice(0, 10);
  }
  await mkdir(caddyDir(), { recursive: true });
  await writeFile(SETTINGS_FILE(), JSON.stringify(next, null, 1));
  return { error: await applyHttps() };
}

/** Use the owner's own domain with the certificate they got for it (e.g. from their DNS provider). */
export async function setDomainCertificate(domain: string, certPem: string, keyPem: string): Promise<{ error: string | null }> {
  const name = domain.trim().toLowerCase();
  if (!NAME_RE.test(name) || !name.includes(".")) return { error: "Type the full domain name, for example home.example.com." };
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(certPem);
  } catch {
    return { error: "The certificate file could not be read. Use the PEM file (it starts with -----BEGIN CERTIFICATE-----)." };
  }
  try {
    if (!cert.checkPrivateKey(createPrivateKey(keyPem))) return { error: "The key file does not belong to this certificate." };
  } catch {
    return { error: "The key file could not be read. Use the PEM key file (-----BEGIN … PRIVATE KEY-----)." };
  }
  if (!cert.checkHost(name)) return { error: `This certificate is not for ${name}.` };
  if (Date.parse(cert.validTo) < Date.now()) return { error: "This certificate has expired." };
  const files = domainCertFiles(name);
  await mkdir(files.dir, { recursive: true });
  await writeFile(files.cert, certPem);
  await writeFile(files.key, keyPem, { mode: 0o600 });
  const settings = await readHttpsSettings();
  await writeFile(SETTINGS_FILE(), JSON.stringify({ ...settings, domain: name }, null, 1));
  return { error: await applyHttps() };
}

export async function removeDomain(): Promise<{ error: string | null }> {
  const settings = await readHttpsSettings();
  if (settings.domain) {
    const files = domainCertFiles(settings.domain);
    await rm(files.cert, { force: true });
    await rm(files.key, { force: true });
  }
  await writeFile(SETTINGS_FILE(), JSON.stringify({ ...settings, domain: null }, null, 1));
  return { error: await applyHttps() };
}

export async function homeCertificatePem(): Promise<string | null> {
  try {
    return await readFile(ROOT_CERT(), "utf8");
  } catch {
    return null;
  }
}

export type HttpsStatus = {
  settings: HttpsSettings;
  httpsPort: number;
  /** Secure addresses to use, best first. */
  addresses: string[];
  /** Plain addresses at home: the announced local name and the server's address. */
  localAddresses: string[];
  homeCertificate: { name: string; validTo: string; fingerprint: string } | null;
  domainCertificate: { validTo: string; issuer: string } | null;
};

export async function httpsStatus(): Promise<HttpsStatus> {
  const settings = await readHttpsSettings();
  const ip = detectedHostIp() ?? process.env.SERVER_IP ?? null;
  const port = ports().https;
  const suffix = port === 443 ? "" : `:${port}`;
  const pem = await homeCertificatePem();
  let home: HttpsStatus["homeCertificate"] = null;
  if (pem) {
    const c = new X509Certificate(pem);
    home = { name: c.subject.replace(/^CN=/, ""), validTo: new Date(c.validTo).toISOString(), fingerprint: c.fingerprint256 };
  }
  const domainCert = await readDomainCert(settings.domain);
  const names = homeNames(settings, ip).filter((n) => n !== "localhost");
  const addresses = settings.enabled
    ? [...(settings.domain && domainCert ? [settings.domain] : []), ...names].map((n) => `https://${n}${suffix}`)
    : [];
  const localName = `${(process.env.LOCAL_NAME || "nexternel").toLowerCase()}.local`;
  return {
    settings,
    httpsPort: port,
    addresses,
    localAddresses: [`http://${localName}`, ...(ip ? [`http://${ip}`] : [])],
    homeCertificate: home,
    domainCertificate: domainCert ? { validTo: new Date(domainCert.validTo).toISOString(), issuer: domainCert.issuer.split("\n").find((l) => l.startsWith("O="))?.slice(2) ?? domainCert.issuer } : null,
  };
}
