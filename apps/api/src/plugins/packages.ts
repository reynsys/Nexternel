import { createHash, randomBytes } from "crypto";
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import type { PluginManifest } from "@nexternel/plugin-sdk";
import { validatePluginManifest } from "./validate.js";

/** Shared with the plugin container (docker-compose: ./plugins). */
export function pluginsDir(): string {
  return process.env.PLUGINS_DIR || "/plugins";
}

/** Official plugins: published from the owner's GitHub. Override for testing with PLUGIN_CATALOG_URL. */
export const OFFICIAL_CATALOG_URL =
  "https://github.com/reynsys/Nexternel-plugins/releases/latest/download/catalog.json";

export function catalogUrl(): string {
  return process.env.PLUGIN_CATALOG_URL || OFFICIAL_CATALOG_URL;
}

const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 2000;

export type CatalogEntry = {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  minNexternel?: string;
  url: string;
  sha256: string;
  size?: number;
  permissions: PluginManifest["permissions"];
};

export function packageFolder(id: string, version: string): string {
  return path.join(pluginsDir(), "packages", id, version);
}

export async function packageInstalled(id: string, version: string): Promise<boolean> {
  try {
    await stat(path.join(packageFolder(id, version), "manifest.json"));
    return true;
  } catch {
    return false;
  }
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Read and check a package without writing anything. */
export async function inspectPackage(
  data: Buffer
): Promise<{ ok: true; manifest: PluginManifest; zip: JSZip } | { ok: false; errors: string[] }> {
  if (data.length > MAX_PACKAGE_BYTES) return { ok: false, errors: ["The package is larger than 50 MB."] };
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return { ok: false, errors: ["This file is not a Nexternel plugin package (it must be a .zip)."] };
  }
  const names = Object.keys(zip.files);
  if (names.length > MAX_FILES) return { ok: false, errors: ["The package has too many files."] };
  for (const name of names) {
    const entry = zip.files[name]!;
    const normal = path.posix.normalize(name);
    if (name.startsWith("/") || normal.startsWith("..") || name.includes("\\")) {
      return { ok: false, errors: [`Unsafe file path in package: ${name}`] };
    }
    // Symbolic links could point outside the plugin's folder.
    const mode = (entry as unknown as { unixPermissions?: number | null }).unixPermissions ?? 0;
    if ((mode & 0o170000) === 0o120000) {
      return { ok: false, errors: [`Links are not allowed in a plugin package: ${name}`] };
    }
  }
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) return { ok: false, errors: ["manifest.json is missing from the package."] };
  let raw: unknown;
  try {
    raw = JSON.parse(await manifestFile.async("string"));
  } catch {
    return { ok: false, errors: ["manifest.json is not valid JSON."] };
  }
  const validated = validatePluginManifest(raw);
  if (!validated.ok) return validated;
  if (!zip.file(validated.manifest.main ?? "main.mjs")) {
    return { ok: false, errors: [`The package has no ${validated.manifest.main ?? "main.mjs"}.`] };
  }
  return { ok: true, manifest: validated.manifest, zip };
}

/** Unpack into packages/<id>/<version>; replaces an earlier copy of the same version. */
export async function extractPackage(manifest: PluginManifest, zip: JSZip): Promise<string> {
  const target = packageFolder(manifest.id, manifest.version);
  const staging = `${target}.tmp-${randomBytes(4).toString("hex")}`;
  await mkdir(staging, { recursive: true });
  try {
    for (const [name, entry] of Object.entries(zip.files)) {
      const dest = path.join(staging, path.posix.normalize(name));
      if (!dest.startsWith(staging + path.sep)) throw new Error(`Unsafe path ${name}`);
      if (entry.dir) {
        await mkdir(dest, { recursive: true });
        continue;
      }
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, await entry.async("nodebuffer"));
      // Plugins run as their own user: code must be readable, never writable by them.
      await chmod(dest, 0o644);
    }
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
  } catch (err) {
    await rm(staging, { recursive: true, force: true });
    throw err;
  }
  return target;
}

export async function removePackages(id: string): Promise<void> {
  await rm(path.join(pluginsDir(), "packages", id), { recursive: true, force: true });
  await rm(path.join(pluginsDir(), "data", id), { recursive: true, force: true });
}

async function fetchLimited(url: string, maxBytes: number): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status}) from ${url}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("Download is too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("Download is too large");
  return buf;
}

let catalogCache: { at: number; url: string; entries: CatalogEntry[] } | null = null;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The official plugin list (cached 10 minutes). */
export async function fetchCatalog(force = false): Promise<CatalogEntry[]> {
  const url = catalogUrl();
  if (!force && catalogCache && catalogCache.url === url && Date.now() - catalogCache.at < 600_000) {
    return catalogCache.entries;
  }
  const raw = JSON.parse((await fetchLimited(url, 1024 * 1024)).toString("utf8")) as unknown;
  const list = isRecord(raw) && Array.isArray(raw.plugins) ? raw.plugins : [];
  const entries: CatalogEntry[] = [];
  for (const p of list) {
    if (!isRecord(p) || typeof p.id !== "string" || typeof p.version !== "string") continue;
    if (typeof p.url !== "string" || typeof p.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(p.sha256)) continue;
    entries.push({
      id: p.id,
      name: typeof p.name === "string" ? p.name : p.id,
      version: p.version,
      description: typeof p.description === "string" ? p.description : "",
      author: typeof p.author === "string" ? p.author : "",
      minNexternel: typeof p.minNexternel === "string" ? p.minNexternel : undefined,
      url: new URL(p.url, url).toString(),
      sha256: p.sha256,
      size: typeof p.size === "number" ? p.size : undefined,
      permissions: isRecord(p.permissions) ? (p.permissions as PluginManifest["permissions"]) : {},
    });
  }
  catalogCache = { at: Date.now(), url, entries };
  return entries;
}

/** Download an official package and check it is exactly the one the catalog lists. */
export async function downloadCatalogPackage(entry: CatalogEntry): Promise<Buffer> {
  const data = await fetchLimited(entry.url, MAX_PACKAGE_BYTES);
  if (sha256(data) !== entry.sha256) {
    throw new Error("The downloaded plugin does not match the official list (checksum differs). Nothing was installed.");
  }
  return data;
}

/** Secret the plugin container uses to talk to the API; readable only by root inside it. */
export async function ensureHostKey(): Promise<string> {
  const file = path.join(pluginsDir(), ".host-key");
  try {
    const existing = (await readFile(file, "utf8")).trim();
    if (existing.length >= 32) return existing;
  } catch {
    /* create below */
  }
  await mkdir(pluginsDir(), { recursive: true });
  const key = randomBytes(32).toString("base64url");
  await writeFile(file, key + "\n", { mode: 0o600 });
  return key;
}
