import { access } from "fs/promises";
import { join } from "path";
import { getPool } from "../db.js";
import { listDevicesDetailed } from "../devices/service.js";
import { refreshTelemetrySubscriptions } from "../telemetry/mqtt.js";
import { loadEsphomeYaml } from "./yaml.js";

const ESPHOME_DIRS = ["/esphome", join(process.cwd(), "..", "..", "esphome")];

const DEFAULT_PRUNE_INTERVAL_MS = 15 * 60 * 1000;
const STARTUP_PRUNE_DELAY_MS = 60 * 1000;

let pruneTimer: ReturnType<typeof setInterval> | null = null;

async function esphomeDirReadable(): Promise<boolean> {
  for (const dir of ESPHOME_DIRS) {
    try {
      await access(dir);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function yamlExistsForStem(stem: string): Promise<boolean> {
  const yaml = await loadEsphomeYaml(stem);
  return Boolean(yaml);
}

export async function yamlExistsForDevice(device: {
  esphomeName: string | null;
  slug: string;
  mqttTopicPrefix: string;
  esphomeYamlPath?: string | null;
}): Promise<boolean> {
  const pathStem = device.esphomeYamlPath?.trim().replace(/\.yaml$/, "").replace(/^devices\//, "");
  const candidates = [
    pathStem,
    device.esphomeName?.trim(),
    device.slug?.trim(),
    device.mqttTopicPrefix?.split("/").pop()?.trim(),
  ].filter((c): c is string => Boolean(c));

  const tried = new Set<string>();
  for (const stem of candidates) {
    if (tried.has(stem)) continue;
    tried.add(stem);
    if (await yamlExistsForStem(stem)) return true;
  }
  return false;
}

export type EsphomeYamlConfigSyncResult = {
  markedMissing: { id: string; name: string }[];
  restored: { id: string; name: string }[];
};

/**
 * Mark ESPHome devices whose YAML is missing (configuration_missing).
 * Restore devices when YAML reappears. Never deletes device rows.
 */
export async function syncEsphomeYamlConfigStatus(): Promise<EsphomeYamlConfigSyncResult> {
  if (!(await esphomeDirReadable())) {
    return { markedMissing: [], restored: [] };
  }

  const devices = await listDevicesDetailed();
  const markedMissing: { id: string; name: string }[] = [];
  const restored: { id: string; name: string }[] = [];

  for (const device of devices) {
    if ((device.firmwareType || "esphome") !== "esphome") continue;
    const exists = await yamlExistsForDevice(device);

    if (!exists && device.esphomeLifecycleState !== "configuration_missing") {
      await getPool().query(
        `UPDATE devices SET esphome_lifecycle_state = 'configuration_missing', updated_at = NOW()
         WHERE id = $1`,
        [device.id]
      );
      markedMissing.push({ id: device.id, name: device.name });
      continue;
    }

    if (exists && device.esphomeLifecycleState === "configuration_missing") {
      await getPool().query(
        `UPDATE devices SET esphome_lifecycle_state = 'configured', updated_at = NOW()
         WHERE id = $1`,
        [device.id]
      );
      restored.push({ id: device.id, name: device.name });
    }
  }

  if (markedMissing.length > 0 || restored.length > 0) {
    await refreshTelemetrySubscriptions();
  }

  return { markedMissing, restored };
}

/** @deprecated Use syncEsphomeYamlConfigStatus — kept for callers expecting the old name. */
export async function pruneEsphomeDevicesMissingYaml(): Promise<{
  removed: { id: string; name: string }[];
}> {
  const { markedMissing } = await syncEsphomeYamlConfigStatus();
  return { removed: markedMissing };
}

function pruneIntervalMs(): number {
  const raw = process.env.ESPHOME_ORPHAN_PRUNE_INTERVAL_MS?.trim();
  if (!raw) return DEFAULT_PRUNE_INTERVAL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 60_000 ? parsed : DEFAULT_PRUNE_INTERVAL_MS;
}

/** Periodic background YAML presence check — marks missing config, never deletes devices. */
export function startEsphomeOrphanPruneLoop(
  log: { info: (obj: unknown, msg?: string) => void; warn: (obj: unknown, msg?: string) => void }
): void {
  if (pruneTimer) return;

  const run = async () => {
    try {
      const { markedMissing, restored } = await syncEsphomeYamlConfigStatus();
      if (markedMissing.length > 0) {
        log.info({ markedMissing }, "ESPHome YAML missing — devices marked configuration_missing");
      }
      if (restored.length > 0) {
        log.info({ restored }, "ESPHome YAML restored — devices cleared configuration_missing");
      }
    } catch (err) {
      log.warn({ err }, "ESPHome YAML config sync failed");
    }
  };

  setTimeout(() => void run(), STARTUP_PRUNE_DELAY_MS);
  pruneTimer = setInterval(() => void run(), pruneIntervalMs());
}
