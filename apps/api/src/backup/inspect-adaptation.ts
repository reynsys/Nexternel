import { config } from "../config.js";
import { installationId } from "./format.js";
import type { BackupManifest, OperationalBackup } from "./types.js";
import { detectBrokerIpFromEsphomeArchive } from "./esphome-cutover.js";

export type NetworkAdaptationPreview = {
  differentInstallation: boolean;
  backupServerIp: string | null;
  currentServerIp: string | null;
  backupMqttTopicPrefix: string;
  currentMqttTopicPrefix: string;
  adaptations: { label: string; from: string; to: string }[];
  wifiMayBeRequired: boolean;
  usersInBackup: number;
  automationsIncluded: boolean;
  historyIncluded: boolean;
};

export function buildNetworkAdaptationPreview(opts: {
  manifest: BackupManifest;
  operational: OperationalBackup | null;
  esphomeFiles: { rel: string; data: Buffer }[];
}): NetworkAdaptationPreview {
  const currentServerIp = (config.serverIp() || "").trim() || null;
  const currentTopic =
    (process.env.MQTT_TOPIC_PREFIX || "nexternel").trim() || "nexternel";

  const backupServerIp =
    opts.operational?.serverIp?.trim() ||
    detectBrokerIpFromEsphomeArchive(opts.esphomeFiles) ||
    null;
  const backupTopic = opts.operational?.mqttTopicPrefix?.trim() || "nexternel";

  const differentInstallation =
    opts.manifest.installationId !== installationId() ||
    (backupServerIp && currentServerIp && backupServerIp !== currentServerIp) ||
    backupTopic !== currentTopic;

  const adaptations: NetworkAdaptationPreview["adaptations"] = [];

  if (backupServerIp && currentServerIp && backupServerIp !== currentServerIp) {
    adaptations.push({
      label: "Server address",
      from: backupServerIp,
      to: currentServerIp,
    });
  } else if (backupServerIp && !currentServerIp) {
    adaptations.push({
      label: "Server address",
      from: backupServerIp,
      to: "This installation",
    });
  }

  adaptations.push({
    label: "MQTT broker",
    from: backupServerIp || "Previous installation",
    to: currentServerIp || "This installation",
  });

  if (backupTopic !== currentTopic) {
    adaptations.push({
      label: "MQTT topic prefix",
      from: backupTopic,
      to: currentTopic,
    });
  } else {
    adaptations.push({
      label: "MQTT credentials",
      from: "Previous installation",
      to: "This installation",
    });
  }

  adaptations.push({
    label: "Internal service credentials",
    from: "Previous installation",
    to: "This installation (unchanged)",
  });

  const hasSecrets = opts.esphomeFiles.some((f) =>
    /secrets\.ya?ml$/i.test(f.rel)
  );
  const wifiMayBeRequired =
    differentInstallation &&
    hasSecrets &&
    opts.esphomeFiles.some((f) => {
      const text = f.data.toString("utf8");
      return /wifi_ssid|wifi_password/i.test(text);
    });

  return {
    differentInstallation,
    backupServerIp,
    currentServerIp,
    backupMqttTopicPrefix: backupTopic,
    currentMqttTopicPrefix: currentTopic,
    adaptations,
    wifiMayBeRequired,
    usersInBackup: opts.manifest.counts.users,
    automationsIncluded: opts.manifest.counts.automationsIncluded,
    historyIncluded: opts.manifest.counts.historyIncluded,
  };
}
