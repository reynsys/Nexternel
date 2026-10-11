import { createHash } from "crypto";
import JSZip from "jszip";
import { config } from "../config.js";
import { APP_VERSION } from "../version.js";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_MAGIC,
  DOMAIN_EXPORT_VERSION,
  SCHEMA_GENERATION,
  type BackupManifest,
  type OperationalBackup,
} from "./types.js";
import { decryptPayload, encryptPayload } from "./crypto.js";
import type { DomainExport } from "./domain-export.js";
import { countPanelsAndPlugins } from "./counts.js";

export function installationId(): string {
  return createHash("sha256")
    .update(config.jwtSecret())
    .update(config.databaseUrl())
    .digest("hex")
    .slice(0, 16);
}

export function buildManifest(opts: {
  domain: DomainExport;
  components: BackupManifest["components"];
  historyApproxBytes?: number;
  payloadSha256: string;
}): BackupManifest {
  const { panels, plugins } = countPanelsAndPlugins(opts.domain.dashboards);
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    domainExportVersion: DOMAIN_EXPORT_VERSION,
    schemaGeneration: SCHEMA_GENERATION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    installationId: installationId(),
    components: opts.components,
    counts: {
      areas: opts.domain.areas.length,
      devices: opts.domain.devices.length,
      capabilities: opts.domain.capabilities.length,
      dashboards: opts.domain.dashboards.length,
      panels,
      plugins,
      cameras: opts.domain.cameras.length,
      users: opts.domain.users.length,
      roles: opts.domain.roles.length,
      automationsIncluded: opts.components.automations,
      historyIncluded: opts.components.history,
      historyApproxBytes: opts.historyApproxBytes,
    },
    compatibility: {
      minRestoreAppVersion: "V4.0.000",
      notes: [],
    },
    integrity: {
      payloadSha256: opts.payloadSha256,
      algorithm: "sha256",
    },
  };
}

export async function packInnerArchive(files: {
  domain: DomainExport;
  esphome: { rel: string; data: Buffer }[];
  influx: { rel: string; data: Buffer }[];
  operational: OperationalBackup | null;
  mosquittoPasswd?: Buffer | null;
  includeHistory: boolean;
}): Promise<{ zipBuffer: Buffer; manifest: BackupManifest }> {
  const zip = new JSZip();
  zip.file("home/domain.json", JSON.stringify(files.domain, null, 2));

  for (const f of files.esphome) {
    zip.file(`esphome/${f.rel}`, f.data);
  }

  let historyBytes = 0;
  if (files.includeHistory) {
    for (const f of files.influx) {
      zip.file(`history/influx/${f.rel}`, f.data);
      historyBytes += f.data.length;
    }
  }

  if (files.operational) {
    zip.file("operational/mqtt.json", JSON.stringify(files.operational, null, 2));
  }
  if (files.mosquittoPasswd?.length) {
    zip.file("operational/mosquitto/passwd", files.mosquittoPasswd);
  }

  const zipBuffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );

  const payloadSha256 = await contentSha256(zip);
  const manifest = buildManifest({
    domain: files.domain,
    components: {
      home: true,
      esphome: files.esphome.length > 0,
      // Node-RED automations were removed in V5.2.76; older backups may still carry them.
      automations: false,
      history: files.includeHistory && files.influx.length > 0,
      operational: !!files.operational,
    },
    historyApproxBytes: historyBytes || undefined,
    payloadSha256,
  });

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const finalBuffer = Buffer.from(
    await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })
  );

  return { zipBuffer: finalBuffer, manifest };
}

export function sealBackup(password: string, innerZip: Buffer): Buffer {
  const encrypted = encryptPayload(password, innerZip);
  const magic = Buffer.from(BACKUP_MAGIC, "utf8");
  return Buffer.concat([magic, encrypted]);
}

export async function openBackup(password: string, file: Buffer): Promise<{
  manifest: BackupManifest;
  innerZip: JSZip;
}> {
  const magic = Buffer.from(BACKUP_MAGIC, "utf8");
  if (file.length < magic.length || !file.subarray(0, magic.length).equals(magic)) {
    throw new Error("backup_corrupt");
  }
  const encrypted = file.subarray(magic.length);
  let plaintext: Buffer;
  try {
    plaintext = decryptPayload(password, encrypted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "backup_password_invalid") throw err;
    throw new Error("backup_corrupt");
  }

  return loadInnerArchive(plaintext);
}

async function contentSha256(zip: JSZip): Promise<string> {
  const names = Object.keys(zip.files)
    .filter((n) => n !== "manifest.json" && !zip.files[n]!.dir)
    .sort();
  const hash = createHash("sha256");
  for (const name of names) {
    hash.update(name);
    hash.update("\0");
    hash.update(await zip.files[name]!.async("nodebuffer"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function loadInnerArchive(plaintext: Buffer): Promise<{
  manifest: BackupManifest;
  innerZip: JSZip;
}> {
  const innerZip = await JSZip.loadAsync(plaintext);
  const manifestEntry = innerZip.file("manifest.json");
  const domainEntry = innerZip.file("home/domain.json");
  if (!manifestEntry || !domainEntry) {
    throw new Error("backup_corrupt");
  }

  const manifest = JSON.parse(await manifestEntry.async("string")) as BackupManifest;
  if (manifest.format !== BACKUP_FORMAT) {
    throw new Error("backup_incompatible");
  }
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error("backup_incompatible");
  }

  const actualHash = await contentSha256(innerZip);
  if (manifest.integrity?.payloadSha256 && manifest.integrity.payloadSha256 !== actualHash) {
    throw new Error("backup_corrupt");
  }

  return { manifest, innerZip };
}

export function checkCompatibility(manifest: BackupManifest): {
  compatible: boolean;
  warnings: string[];
  blockingErrors: string[];
} {
  const warnings: string[] = [];
  const blockingErrors: string[] = [];

  if (manifest.schemaGeneration > SCHEMA_GENERATION) {
    blockingErrors.push(
      `Backup requires schema generation ${manifest.schemaGeneration}; this server supports ${SCHEMA_GENERATION}.`
    );
  }

  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    blockingErrors.push(
      `Backup format v${manifest.formatVersion} is newer than this server supports (v${BACKUP_FORMAT_VERSION}).`
    );
  }

  return {
    compatible: blockingErrors.length === 0,
    warnings,
    blockingErrors,
  };
}

export async function readDomainFromZip(innerZip: JSZip): Promise<DomainExport> {
  const domainEntry = innerZip.file("home/domain.json");
  if (!domainEntry) throw new Error("backup_corrupt");
  const domain = JSON.parse(await domainEntry.async("string")) as DomainExport;
  if (!domain || !Array.isArray(domain.areas) || !Array.isArray(domain.devices)) {
    throw new Error("backup_corrupt");
  }
  domain.dashboards = Array.isArray(domain.dashboards) ? domain.dashboards : [];
  domain.cameras = Array.isArray(domain.cameras) ? domain.cameras : [];
  domain.capabilities = Array.isArray(domain.capabilities) ? domain.capabilities : [];
  domain.capabilityBindings = Array.isArray(domain.capabilityBindings)
    ? domain.capabilityBindings
    : [];
  domain.groups = Array.isArray(domain.groups) ? domain.groups : [];
  domain.users = Array.isArray(domain.users) ? domain.users : [];
  domain.roles = Array.isArray(domain.roles) ? domain.roles : [];
  if (!domain.integrations) domain.integrations = { octopus: null };
  return domain;
}
