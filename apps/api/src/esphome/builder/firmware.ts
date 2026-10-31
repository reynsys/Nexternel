import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import type { EsphomeLifecycleState } from "@nexternel/domain";
import { getPool } from "../../db.js";
import { esphomeDir, pathExists } from "../../migrate/paths.js";
import {
  esphomeSuggestionForDevice,
  getDeviceDetailed,
  syncDeviceFromEsphomeSuggestion,
} from "../../devices/service.js";
import { refreshTelemetrySubscriptions } from "../../telemetry/mqtt.js";
import {
  buildCacheMismatch,
  esphomeCompileLogFailed,
  esphomeCompileSucceeded,
} from "../cli-log.js";
import { assertEsphomeBuildPrerequisites } from "../secrets.js";
import { loadEsphomeYaml } from "../yaml.js";
import { fileAddress, filesForAddress, forgetFileAddress } from "../file-identity.js";
import { writeDeviceYamlFile } from "./storage.js";
import { runEsphomeJob } from "../esphome-jobs.js";

const execFileAsync = promisify(execFile);

const ESPHOME_CONTAINER = process.env.ESPHOME_CONTAINER_NAME || "nexternel-esphome";
/** First ESP-IDF framework install + compile can exceed 10 minutes on a small server. */
const CLI_TIMEOUT_MS = 1_200_000;

type DeviceEsphomeMeta = {
  id: string;
  esphome_name: string | null;
  slug: string;
  firmware_type: string;
  esphome_yaml_path: string | null;
  esphome_management_mode: string | null;
};

async function getDeviceEsphomeMeta(deviceId: string): Promise<DeviceEsphomeMeta | null> {
  const res = await getPool().query<DeviceEsphomeMeta & { mqtt_topic_prefix: string | null }>(
    `SELECT id, esphome_name, slug, firmware_type, esphome_yaml_path, esphome_management_mode, mqtt_topic_prefix
     FROM devices WHERE id = $1`,
    [deviceId]
  );
  const meta = res.rows[0] ?? null;
  if (meta && meta.firmware_type === "esphome" && !meta.esphome_yaml_path?.trim()) await linkYamlFile(meta);
  return meta;
}

/**
 * A board without a linked settings file gets the one whose message address is exactly its own
 * (ESPHome reads the files: esphome/file-identity.ts) — linked once. None or several: left unlinked,
 * and the person links it (Devices → the board → Board software).
 */
async function linkYamlFile(meta: DeviceEsphomeMeta & { mqtt_topic_prefix: string | null }): Promise<void> {
  if (!meta.mqtt_topic_prefix) return;
  const files = await filesForAddress(meta.mqtt_topic_prefix);
  if (files.length !== 1) return;
  meta.esphome_yaml_path = files[0]!;
  await getPool().query(`UPDATE devices SET esphome_yaml_path = $2 WHERE id = $1 AND COALESCE(esphome_yaml_path, '') = ''`, [meta.id, files[0]]);
}

/** Link a board to a settings file chosen by the person; only a file with the board's own address. */
export async function linkDeviceYamlFile(deviceId: string, file: string): Promise<void> {
  const meta = requireEsphomeMeta(await getDeviceEsphomeMeta(deviceId));
  const address = await fileAddress(file);
  const own = (meta as DeviceEsphomeMeta & { mqtt_topic_prefix?: string | null }).mqtt_topic_prefix ?? null;
  if (!address) throw new Error(`ESPHome could not read ${file}, or it has no MQTT address.`);
  if (address !== own) throw new Error(`${file} belongs to the board that reports on ${address}, but this device listens on ${own ?? "no address"}.`);
  await getPool().query(`UPDATE devices SET esphome_yaml_path = $2 WHERE id = $1`, [deviceId, file]);
}

function yamlRelativePath(meta: DeviceEsphomeMeta): string {
  const raw = meta.esphome_yaml_path?.trim();
  if (raw) return raw.replace(/^\/+/, "");
  const stem = meta.esphome_name?.trim() || meta.slug;
  return `${stem}.yaml`;
}

function yamlConfigPath(meta: DeviceEsphomeMeta): string {
  return `/config/${yamlRelativePath(meta)}`;
}

function yamlStem(meta: DeviceEsphomeMeta): string {
  return yamlRelativePath(meta).replace(/\.yaml$/, "").replace(/^devices\//, "");
}

async function setLifecycleState(
  deviceId: string,
  state: EsphomeLifecycleState
): Promise<void> {
  await getPool().query(
    `UPDATE devices SET esphome_lifecycle_state = $2, updated_at = NOW() WHERE id = $1`,
    [deviceId, state]
  );
}

function execOutput(err: unknown): string {
  if (!err || typeof err !== "object") {
    return err instanceof Error ? err.message : "ESPHome command failed";
  }
  const e = err as { stdout?: string; stderr?: string; message?: string };
  return [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
}

async function runEsphomeCli(args: string[]): Promise<{ ok: true; log: string } | { ok: false; log: string }> {
  try {
    // Through ESPHome's own start-up script, never `esphome` directly: the script sets where ESPHome
    // keeps its build tools (ESP-IDF, PlatformIO) in the kept /config folder — the same setup the
    // ESPHome page uses. Run directly, ESPHome used a temporary folder instead, so builds made by one
    // did not match the other ("does not match the source … used to generate cache").
    const { stdout, stderr } = await execFileAsync(
      "docker",
      ["exec", ESPHOME_CONTAINER, "/entrypoint.sh", ...args],
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 12 * 1024 * 1024 }
    );
    return { ok: true, log: [stdout, stderr].filter(Boolean).join("\n").trim() };
  } catch (err) {
    return { ok: false, log: execOutput(err) };
  }
}

function requireEsphomeMeta(meta: DeviceEsphomeMeta | null): DeviceEsphomeMeta {
  if (!meta) throw new Error("Device not found");
  if (meta.firmware_type !== "esphome") {
    throw new Error("Only ESPHome devices support this action");
  }
  return meta;
}

async function requireYamlOnDisk(meta: DeviceEsphomeMeta): Promise<string> {
  const yamlPath = yamlRelativePath(meta);
  // Not linked: the usual file name is used only when that file's board is this device (same address).
  const own = (meta as DeviceEsphomeMeta & { mqtt_topic_prefix?: string | null }).mqtt_topic_prefix ?? null;
  if (!meta.esphome_yaml_path?.trim() && own) {
    const address = await fileAddress(yamlPath);
    if (address && address !== own) {
      throw new Error(`${yamlPath} belongs to another board (${address}). Link this device's own settings file first (Devices → the board → Board software).`);
    }
  }
  const existing = await loadEsphomeYaml(yamlStem(meta));
  if (!existing) {
    throw new Error(`ESPHome configuration not found for this device (${yamlPath})`);
  }
  return yamlPath;
}

export async function readDeviceEsphomeYaml(
  deviceId: string
): Promise<{ yaml: string; path: string; managementMode: string | null } | null> {
  const meta = await getDeviceEsphomeMeta(deviceId);
  if (!meta || meta.firmware_type !== "esphome") return null;

  const path = yamlRelativePath(meta);
  const yaml = await loadEsphomeYaml(yamlStem(meta));
  if (!yaml) return null;
  return { yaml, path, managementMode: meta.esphome_management_mode };
}

export type FirmwareActionResult = {
  ok: boolean;
  lifecycleState: EsphomeLifecycleState;
  log: string;
  yamlPath: string;
};

const FIRMWARE_BIN_CANDIDATES = [
  "firmware.factory.bin",
  "firmware.bin",
  "firmware.ota.bin",
] as const;

export function compiledFirmwarePath(stem: string): string | null {
  const buildDir = path.join(esphomeDir(), ".esphome", "build", stem, "build");
  for (const name of FIRMWARE_BIN_CANDIDATES) {
    const full = path.join(buildDir, name);
    if (pathExists(full)) return full;
  }
  return null;
}

/** Read compiled firmware from the shared esphome/.esphome/build tree (after compile). */
export async function readCompiledFirmware(
  deviceId: string
): Promise<{ buffer: Buffer; filename: string; artifact: string } | null> {
  const meta = requireEsphomeMeta(await getDeviceEsphomeMeta(deviceId));
  const stem = yamlStem(meta);
  const buildDir = path.join(esphomeDir(), ".esphome", "build", stem, "build");
  for (const name of FIRMWARE_BIN_CANDIDATES) {
    const full = path.join(buildDir, name);
    if (!pathExists(full)) continue;
    const buffer = fs.readFileSync(full);
    return {
      buffer,
      filename: `${stem}-${name}`,
      artifact: name,
    };
  }
  return null;
}

/** Build the board's software (ESPHome compile). */
export async function compileEsphomeDevice(deviceId: string): Promise<FirmwareActionResult> {
  const meta = requireEsphomeMeta(await getDeviceEsphomeMeta(deviceId));
  const yamlPath = await requireYamlOnDisk(meta);
  const configPath = yamlConfigPath(meta);

  assertEsphomeBuildPrerequisites();

  await setLifecycleState(deviceId, "building");
  const compileStartedMs = Date.now();
  const stem = yamlStem(meta);
  // Built by ESPHome's own job list, so ESPHome's record of the board stays right (esphome-jobs.ts).
  let result = await runEsphomeJob("compile", yamlPath);
  // A board's build files made with another setup of the build tools: clear them and build once more.
  if (!result.ok && buildCacheMismatch(result.log)) {
    await runEsphomeCli(["clean", configPath]);
    result = await runEsphomeJob("compile", yamlPath);
  }
  const firmwarePath = compiledFirmwarePath(stem);
  const firmwareFresh =
    firmwarePath !== null &&
    fs.statSync(firmwarePath).mtimeMs >= compileStartedMs - 10_000;

  if (result.ok || (firmwareFresh && !esphomeCompileLogFailed(result.log))) {
    const log =
      result.ok || esphomeCompileSucceeded(result.log, false)
        ? result.log
        : `${result.log}\nINFO Firmware binary found on server after build.`;
    await setLifecycleState(deviceId, "firmware_ready");
    return { ok: true, lifecycleState: "firmware_ready", log, yamlPath };
  }
  await setLifecycleState(deviceId, "error");
  return { ok: false, lifecycleState: "error", log: result.log, yamlPath };
}

/** The board's settings file as ESPHome names it (e.g. "garden-relays.yaml"). */
export async function deviceYamlFile(deviceId: string): Promise<string | null> {
  const meta = await getDeviceEsphomeMeta(deviceId);
  return meta && meta.firmware_type === "esphome" ? meta.esphome_yaml_path?.trim() || null : null;
}

/**
 * Send the last build to the board over Wi-Fi (ESPHome upload). `address` is the board's IP when
 * known (ESPHome's own list): finding it by name (.local) often fails inside Docker.
 */
export async function uploadEsphomeDevice(deviceId: string, address?: string | null): Promise<FirmwareActionResult> {
  const meta = requireEsphomeMeta(await getDeviceEsphomeMeta(deviceId));
  const yamlPath = await requireYamlOnDisk(meta);

  await setLifecycleState(deviceId, "connecting");
  // Sent by ESPHome's own job list (ESPHome then records what the board runs); always to an address.
  const result = await runEsphomeJob("upload", yamlPath, address || "OTA");
  if (result.ok) {
    await setLifecycleState(deviceId, "connecting");
    return { ok: true, lifecycleState: "connecting", log: result.log, yamlPath };
  }
  await setLifecycleState(deviceId, "error");
  return { ok: false, lifecycleState: "error", log: result.log, yamlPath };
}

export type ValidateYamlResult = {
  ok: boolean;
  log: string;
};

/** Validate YAML on disk via `esphome config validate`. */
export async function validateDeviceEsphomeYaml(
  deviceId: string
): Promise<ValidateYamlResult> {
  const meta = requireEsphomeMeta(await getDeviceEsphomeMeta(deviceId));
  await requireYamlOnDisk(meta);
  const result = await runEsphomeCli(["config", "validate", yamlConfigPath(meta)]);
  return { ok: result.ok, log: result.log };
}

export type SaveYamlResult = {
  ok: boolean;
  log: string;
  managementMode: string;
  yamlPath: string;
};

/** Save advanced YAML; switches device to advanced management mode. */
export async function saveDeviceEsphomeYaml(
  deviceId: string,
  yaml: string
): Promise<SaveYamlResult> {
  const meta = requireEsphomeMeta(await getDeviceEsphomeMeta(deviceId));
  const relativePath = yamlRelativePath(meta);
  const configPath = yamlConfigPath(meta);

  const stem = yamlStem(meta);
  const previous = await loadEsphomeYaml(stem);

  await writeDeviceYamlFile(relativePath, yaml);
  forgetFileAddress(relativePath);

  const validation = await runEsphomeCli(["config", "validate", configPath]);
  if (!validation.ok) {
    if (previous) {
      await writeDeviceYamlFile(relativePath, previous);
    }
    return {
      ok: false,
      log: validation.log,
      managementMode: meta.esphome_management_mode || "imported",
      yamlPath: relativePath,
    };
  }

  await getPool().query(
    `UPDATE devices SET
       esphome_management_mode = 'advanced',
       esphome_lifecycle_state = 'configured',
       esphome_builder_config = NULL,
       esphome_yaml_path = $2,
       updated_at = NOW()
     WHERE id = $1`,
    [deviceId, relativePath]
  );

  const device = await getDeviceDetailed(deviceId);
  const suggestion = device ? await esphomeSuggestionForDevice(device) : null;
  if (suggestion) {
    await syncDeviceFromEsphomeSuggestion(deviceId, suggestion);
    await refreshTelemetrySubscriptions();
  }

  return {
    ok: true,
    log: validation.log,
    managementMode: "advanced",
    yamlPath: relativePath,
  };
}
