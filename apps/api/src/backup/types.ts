export const BACKUP_FORMAT = "nexternel-backup" as const;
export const BACKUP_FORMAT_VERSION = 1;
export const DOMAIN_EXPORT_VERSION = 1;
export const SCHEMA_GENERATION = 4;

export const BACKUP_MAGIC = "NEXBACKUP\0";

import type { NetworkAdaptationPreview } from "./inspect-adaptation.js";

export type BackupComponents = {
  home: boolean;
  esphome: boolean;
  automations: boolean;
  history: boolean;
  operational: boolean;
};

export type BackupCounts = {
  areas: number;
  devices: number;
  capabilities: number;
  dashboards: number;
  panels: number;
  plugins: number;
  cameras: number;
  users: number;
  roles: number;
  automationsIncluded: boolean;
  historyIncluded: boolean;
  historyApproxBytes?: number;
};

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  domainExportVersion: number;
  schemaGeneration: number;
  appVersion: string;
  createdAt: string;
  installationId: string;
  components: BackupComponents;
  counts: BackupCounts;
  compatibility: {
    minRestoreAppVersion: string;
    notes: string[];
  };
  integrity: {
    payloadSha256: string;
    algorithm: "sha256";
  };
};

export type BackupJobPhase =
  | "queued"
  | "collecting_home"
  | "collecting_esphome"
  | "collecting_automations"
  | "collecting_history"
  | "packaging"
  | "encrypting"
  | "verifying"
  | "ready"
  | "restoring_home"
  | "restoring_esphome"
  | "restoring_automations"
  | "restoring_history"
  | "adapting_network"
  | "syncing"
  | "verifying"
  | "completed"
  | "failed"
  | "expired";

export type BackupJobType = "create" | "restore";

export type BackupJob = {
  id: string;
  type: BackupJobType;
  status: BackupJobPhase;
  percent: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  filename?: string;
  manifest?: BackupManifest;
  error?: { code: string; message: string };
  downloadExpiresAt?: string;
  restoreResult?: RestoreResult;
};

export type RestoreResult = {
  ok: boolean;
  counts?: BackupCounts;
  warnings: string[];
  errors: string[];
  phases: { name: string; ok: boolean; message?: string }[];
};

export type OperationalBackup = {
  mqttUsername: string;
  mqttPassword: string;
  mqttTopicPrefix: string | null;
  serverIp: string;
  /** Zherodius direct lines: this home's line key and each paired device's key (backups from 18/11/2026). */
  zherodius?: ZherodiusBackup;
};

export type ZherodiusBackup = {
  hubKey: string;
  pairings: { deviceId: string; serial: string; address: string; deviceKey: string; version: string | null }[];
};

export type InspectResult = {
  valid: boolean;
  manifest?: BackupManifest;
  compatible: boolean;
  warnings: string[];
  blockingErrors: string[];
  networkAdaptation?: NetworkAdaptationPreview;
};
