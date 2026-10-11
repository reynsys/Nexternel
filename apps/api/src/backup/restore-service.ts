import { createBackupFile, extractZipEntries, restoreEsphomeFromZip, restoreInfluxFromZip, regenerateMosquittoPasswd } from "./collect.js";
import { restoreDomain } from "./domain-restore.js";
import {
  checkCompatibility,
  openBackup,
  readDomainFromZip,
} from "./format.js";
import { createJob, saveJobFile, saveSafetySnapshot, updateJob } from "./jobs.js";
import type { BackupJobPhase, InspectResult, RestoreResult } from "./types.js";
import { config } from "../config.js";
import { writeCarriedMqttLogin } from "../mqtt-login.js";
import { refreshHostIp } from "../system/host-ip.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { repairDashboardCapabilityBindings } from "../migrate/repair-dashboard-bindings.js";
import { refreshTelemetrySubscriptions, getMqttStatus, startTelemetry } from "../telemetry/mqtt.js";
import type { OperationalBackup } from "./types.js";
import {
  detectBrokerIpFromEsphomeArchive,
  rewriteEsphomeForCurrentServer,
} from "./esphome-cutover.js";
import { remapDomainForCurrentServer, restartStackAfterRestore } from "./post-restore.js";
import { buildNetworkAdaptationPreview } from "./inspect-adaptation.js";
import { getPool } from "../db.js";

/** Wait until the API's MQTT client reports connected (after the broker restarted). */
async function waitForMqtt(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getMqttStatus().status === "connected") return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return getMqttStatus().status === "connected";
}

export type RestoreJobOptions = {
  wifiSsid?: string;
  wifiPassword?: string;
  preserveAdminUsername?: string;
};

export function mapBackupError(err: unknown): { code: string; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "backup_password_invalid") {
    return { code: "backup_password_invalid", message: "Incorrect backup password." };
  }
  if (msg === "backup_corrupt") {
    return {
      code: "backup_corrupt",
      message: "This backup is damaged or incomplete and cannot be restored.",
    };
  }
  if (msg === "backup_incompatible") {
    return {
      code: "backup_incompatible",
      message: "This backup is not compatible with this Nexternel installation.",
    };
  }
  return { code: "backup_failed", message: msg || "Backup operation failed." };
}

async function readOperational(innerZip: import("jszip")): Promise<OperationalBackup | null> {
  const mqttJsonEntry = innerZip.file("operational/mqtt.json");
  if (!mqttJsonEntry) return null;
  try {
    return JSON.parse(await mqttJsonEntry.async("string")) as OperationalBackup;
  } catch {
    return null;
  }
}

export async function inspectBackupFile(
  buffer: Buffer,
  password: string
): Promise<InspectResult> {
  try {
    const { manifest, innerZip } = await openBackup(password, buffer);
    const compat = checkCompatibility(manifest);
    const operational = await readOperational(innerZip);
    const esphomeFiles = await extractZipEntries(innerZip, "esphome/");
    const networkAdaptation = buildNetworkAdaptationPreview({
      manifest,
      operational,
      esphomeFiles,
    });
    const warnings = [...compat.warnings];
    if (networkAdaptation.wifiMayBeRequired) {
      warnings.push("If this server is on a different Wi-Fi network from the old one, your devices will need the new Wi-Fi details.");
    }
    return {
      valid: true,
      manifest,
      compatible: compat.compatible,
      warnings,
      blockingErrors: compat.blockingErrors,
      networkAdaptation,
    };
  } catch (err) {
    const mapped = mapBackupError(err);
    if (mapped.code === "backup_password_invalid") {
      return {
        valid: false,
        compatible: false,
        warnings: [],
        blockingErrors: [mapped.message],
      };
    }
    if (mapped.code === "backup_corrupt" || mapped.code === "backup_incompatible") {
      return {
        valid: false,
        compatible: false,
        warnings: [],
        blockingErrors: [mapped.message],
      };
    }
    throw err;
  }
}

async function createSafetySnapshot(jobId: string): Promise<void> {
  const internalPassword = `safety-${jobId}`;
  const { buffer } = await createBackupFile({
    password: internalPassword,
    includeHistory: false,
  });
  saveSafetySnapshot(jobId, buffer);
}

export async function runCreateBackupJob(
  jobId: string,
  password: string,
  includeHistory: boolean
): Promise<void> {
  try {
    const { buffer, filename, manifest } = await createBackupFile({
      password,
      includeHistory,
      onProgress: (phase, percent, message) => {
        updateJob(jobId, {
          status: phase as BackupJobPhase,
          percent,
          message,
        });
      },
    });
    saveJobFile(jobId, buffer);
    updateJob(jobId, {
      status: "ready",
      percent: 100,
      message: "Backup ready",
      filename,
      manifest,
    });
  } catch (err) {
    const mapped = mapBackupError(err);
    updateJob(jobId, {
      status: "failed",
      percent: 0,
      message: mapped.message,
      error: mapped,
    });
  }
}

async function verifyRestore(): Promise<{ ok: boolean; message: string }> {
  const pool = getPool();
  const [areas, devices, mqtt] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM rooms`),
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM devices`),
    Promise.resolve(getMqttStatus()),
  ]);
  const areaCount = Number(areas.rows[0]?.count ?? 0);
  const deviceCount = Number(devices.rows[0]?.count ?? 0);
  if (mqtt.status !== "connected") {
    return {
      ok: false,
      message: "MQTT broker is not connected. Try Restart services in Settings → System.",
    };
  }
  if (areaCount === 0 && deviceCount === 0) {
    return {
      ok: false,
      message: "No areas or devices were found after restore.",
    };
  }
  return {
    ok: true,
    message: `Verified ${areaCount} areas and ${deviceCount} devices.`,
  };
}

export async function runRestoreBackupJob(
  jobId: string,
  buffer: Buffer,
  password: string,
  options: RestoreJobOptions = {}
): Promise<void> {
  // Device files get this server's address: make sure it is the current one, not the install-time one.
  await refreshHostIp();
  const phases: RestoreResult["phases"] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    updateJob(jobId, { status: "queued", percent: 3, message: "Checking backup" });
    const inspect = await inspectBackupFile(buffer, password);
    if (!inspect.valid || !inspect.manifest) {
      throw new Error(inspect.blockingErrors[0] || "backup_corrupt");
    }
    if (!inspect.compatible) {
      throw new Error(inspect.blockingErrors.join(" "));
    }
    warnings.push(...inspect.warnings);

    const { innerZip, manifest } = await openBackup(password, buffer);
    const operational = await readOperational(innerZip);
    const esphomeFiles = await extractZipEntries(innerZip, "esphome/");

    let oldBrokerIp =
      operational?.serverIp?.trim() ||
      detectBrokerIpFromEsphomeArchive(esphomeFiles) ||
      "";

    updateJob(jobId, { status: "queued", percent: 8, message: "Preparing current installation" });
    try {
      await createSafetySnapshot(jobId);
      phases.push({ name: "Safety snapshot", ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Safety snapshot skipped: ${msg}`);
      phases.push({ name: "Safety snapshot", ok: false, message: msg });
    }

    updateJob(jobId, { status: "restoring_home", percent: 15, message: "Restoring home configuration" });
    let domain = await readDomainFromZip(innerZip);
    domain = remapDomainForCurrentServer(domain);

    const { skippedCapabilities, skippedGroups } = await restoreDomain(domain, {
      preserveAdminUsername: options.preserveAdminUsername,
    });
    if (skippedCapabilities.length > 0) {
      warnings.push(
        `Skipped ${skippedCapabilities.length} orphaned capabilities: ${skippedCapabilities.join(", ")}`
      );
    }
    if (skippedGroups.length > 0) {
      warnings.push(
        `Skipped ${skippedGroups.length} orphaned groups: ${skippedGroups.join(", ")}`
      );
    }
    phases.push({ name: "Home configuration", ok: true });

    // Devices still carry the old server's MQTT login in their firmware: keep using it here.
    let carriedMqttLogin = false;
    const oldMqttUser = operational?.mqttUsername?.trim() ?? "";
    const oldMqttPass = operational?.mqttPassword ?? "";
    if (oldMqttUser && oldMqttPass && (oldMqttUser !== config.mqttUsername() || oldMqttPass !== config.mqttPassword())) {
      try {
        writeCarriedMqttLogin({ username: oldMqttUser, password: oldMqttPass });
        carriedMqttLogin = true;
      } catch (err) {
        warnings.push(`Could not keep the backup's MQTT login: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    updateJob(jobId, { status: "restoring_esphome", percent: 35, message: "Restoring devices" });
    const esphomeCount = await restoreEsphomeFromZip(esphomeFiles);

    updateJob(jobId, { status: "adapting_network", percent: 50, message: "Adapting network configuration" });
    let cutoverCount = 0;
    try {
      cutoverCount = rewriteEsphomeForCurrentServer({
        oldBrokerIp,
        devices: domain.devices,
        wifiSsid: options.wifiSsid,
        wifiPassword: options.wifiPassword,
      });
      phases.push({
        name: "Device configuration",
        ok: true,
        message:
          esphomeFiles.length > 0
            ? `${esphomeCount} files restored, ${cutoverCount} updated for this server`
            : "No device files in backup",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Device configuration: ${msg}`);
      phases.push({ name: "Device configuration", ok: false, message: msg });
    }

    const mqttOk = await regenerateMosquittoPasswd(
      config.mqttUsername(),
      config.mqttPassword()
    );
    phases.push({
      name: "MQTT configuration",
      ok: mqttOk,
      message: mqttOk
        ? carriedMqttLogin
          ? "Kept the backup's MQTT login so existing devices reconnect"
          : "Broker aligned to this installation"
        : "MQTT broker password update failed",
    });
    if (!mqttOk) {
      errors.push("MQTT broker password could not be updated.");
    }

    const currentServerIp = (config.serverIp() || "").trim();
    // Node-RED is no longer part of Nexternel (V5.2.76): its files in older backups are skipped.

    if (manifest.components.history) {
      updateJob(jobId, {
        status: "restoring_history",
        percent: 78,
        message: "Restoring historical sensor data",
      });
      const influxFiles = await extractZipEntries(innerZip, "history/influx/");
      try {
        await restoreInfluxFromZip(influxFiles);
        phases.push({ name: "Historical sensor data", ok: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Historical sensor data: ${msg}`);
        phases.push({ name: "Historical sensor data", ok: false, message: msg });
      }
    }

    updateJob(jobId, { status: "syncing", percent: 88, message: "Rebuilding device configuration" });
    try {
      const { reconcileAllEsphomeDevicesFromYaml } = await import(
        "../devices/service.js"
      );
      await reconcileAllEsphomeDevicesFromYaml();
    } catch {
      /* optional */
    }

    try {
      await syncCapabilitiesFromLegacy();
      await repairDashboardCapabilityBindings();
      await refreshTelemetrySubscriptions();
      phases.push({ name: "Live telemetry sync", ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Live telemetry sync: ${msg}`);
      phases.push({ name: "Live telemetry sync", ok: false, message: msg });
    }

    const restart = await restartStackAfterRestore();
    phases.push({
      name: "Restart services",
      ok: restart.ok,
      message: restart.message,
    });
    if (!restart.ok) {
      warnings.push(
        "Services were not restarted automatically. Open Settings → System and use Restart services if Live data does not appear."
      );
    } else {
      // The broker came back with the restored login: wait for the API's MQTT link before verifying.
      updateJob(jobId, { status: "verifying", percent: 92, message: "Reconnecting to devices" });
      // A fresh connection: the old one keeps retrying with the login it started with.
      await startTelemetry().catch(() => {
        /* waitForMqtt reports it */
      });
      const reconnected = await waitForMqtt(60_000);
      if (reconnected) {
        await refreshTelemetrySubscriptions().catch(() => {
          /* verification reports it */
        });
      }
      phases.push({
        name: "Reconnect to MQTT",
        ok: reconnected,
        message: reconnected ? "Connected." : "The MQTT broker did not accept the connection within 60 s.",
      });
    }

    updateJob(jobId, { status: "verifying", percent: 95, message: "Verifying installation" });
    const verification = await verifyRestore();
    phases.push({
      name: "Verification",
      ok: verification.ok,
      message: verification.message,
    });
    if (!verification.ok) {
      errors.push(verification.message);
    }

    if (oldBrokerIp && oldBrokerIp !== currentServerIp) {
      warnings.push(
        `Your devices are still set up for the old server's address (${oldBrokerIp}). They reconnect by themselves once this server has that address — set it in your router — or after each one is updated for this server (${currentServerIp || "its current address"}).`
      );
    }
    if (options.preserveAdminUsername) {
      warnings.push(
        `Your administrator account (${options.preserveAdminUsername}) was kept — its password was not replaced by the backup.`
      );
    }

    const ok = errors.length === 0;
    const result: RestoreResult = {
      ok,
      counts: manifest.counts,
      warnings,
      errors,
      phases,
    };
    updateJob(jobId, {
      status: ok ? "completed" : "failed",
      percent: 100,
      message: ok ? "Restore complete" : "Restore could not be completed.",
      manifest,
      restoreResult: result,
      error: ok ? undefined : { code: "partial_restore", message: errors.join("; ") },
    });
  } catch (err) {
    const mapped = mapBackupError(err);
    updateJob(jobId, {
      status: "failed",
      percent: 0,
      message: mapped.message,
      error: mapped,
      restoreResult: { ok: false, warnings, errors: [mapped.message], phases },
    });
  }
}
