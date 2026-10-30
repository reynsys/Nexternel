import type { StatusLightSettings } from "@nexternel/domain";
import type { PluginManifest } from "@nexternel/plugin-sdk";
import { loadCustomStatusSettings } from "../capabilities/status-lights.js";
import { decryptSecret, isEncryptedSecret } from "../plugins/secrets.js";
import { getBellTopics } from "../notifications/topics.js";
import { getPool } from "../db.js";
import { buildConfigPayload } from "../migrate/export-config.js";
import type { ExportedDashboard } from "../migrate/types.js";
import { DOMAIN_EXPORT_VERSION } from "./types.js";
import { sanitizeDomainExport } from "./domain-sanitize.js";

export type ExportedCapability = {
  id: string;
  deviceId: string;
  kind: string;
  name: string;
  unit: string | null;
  sourceType: string;
  sourceId: string;
  isEnabled: boolean;
  systemId: string | null;
  groupId: string | null;
  areaId: string | null;
  serviceId: string | null;
  /** Your own name and icon (absent in backups made before V5.2.79). */
  customName?: string | null;
  icon?: string | null;
  /** Changed status light limits; absent = the starting limits (and in backups before V5.2.91). */
  statusLight?: StatusLightSettings;
};

export type ExportedCapabilityBinding = {
  id: string;
  capabilityId: string;
  protocol: string;
  stateTopic: string | null;
  commandTopic: string | null;
  valueMap: Record<string, unknown>;
};

export type ExportedGroup = {
  id: string;
  areaId: string;
  systemId: string;
  name: string;
  sortOrder: number;
  isEnabled: boolean;
};

export type ExportedUser = {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string | null;
  isActive: boolean;
  role: string;
  themePrefs: unknown;
  avatarData: string | null;
};

export type ExportedRole = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
  isSystem: boolean;
  sortOrder: number;
  permissions: unknown;
};

export type ExportedOctopus = {
  accountNumber: string;
  apiKey: string;
  electricityDeviceId: string;
  gasDeviceId: string;
  gasConsumptionUnits: string;
  enabled: boolean;
  pollIntervalSec: number;
};

export type DomainExport = {
  exportVersion: typeof DOMAIN_EXPORT_VERSION;
  areas: Awaited<ReturnType<typeof buildConfigPayload>>["rooms"];
  devices: Awaited<ReturnType<typeof buildConfigPayload>>["devices"];
  dashboards: ExportedDashboard[];
  cameras: Awaited<ReturnType<typeof buildConfigPayload>>["cameras"];
  capabilities: ExportedCapability[];
  capabilityBindings: ExportedCapabilityBinding[];
  groups: ExportedGroup[];
  users: ExportedUser[];
  roles: ExportedRole[];
  /** Which of Nexternel's own kinds of message reach the bell (V5.2.146+). */
  bellTopics?: Record<string, boolean>;
  integrations: {
    octopus: ExportedOctopus | null;
    /** Installed plugins (V5.2.86+). Secret settings are stored readable here — the backup itself is encrypted. */
    plugins?: ExportedPlugin[];
  };
};

export type ExportedPlugin = {
  id: string;
  source: string;
  enabled: boolean;
  manifest: PluginManifest;
  grants: Record<string, unknown>;
  settings: Record<string, unknown>;
  /** Which messages reach the bell (V5.2.95+). */
  bell?: string;
};

async function loadPlugins(): Promise<ExportedPlugin[]> {
  const r = await getPool().query<{
    id: string; source: string; enabled: boolean; manifest: PluginManifest; grants: Record<string, unknown>; settings: Record<string, unknown>; bell: string;
  }>(`SELECT id, source, enabled, manifest, grants, settings, bell FROM installed_plugins ORDER BY id`);
  return r.rows.map((row) => {
    const settings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row.settings)) {
      settings[key] = isEncryptedSecret(value) ? { secret: decryptSecret(value) } : value;
    }
    return { id: row.id, source: row.source, enabled: row.enabled, manifest: row.manifest, grants: row.grants, settings, bell: row.bell };
  });
}

async function loadCapabilities(): Promise<ExportedCapability[]> {
  const r = await getPool().query<{
    id: string;
    device_id: string;
    kind: string;
    name: string;
    unit: string | null;
    source_type: string;
    source_id: string;
    is_enabled: boolean;
    system_id: string | null;
    group_id: string | null;
    area_id: string | null;
    service_id: string | null;
    custom_name: string | null;
    icon: string | null;
  }>(
    `SELECT c.id, c.device_id, c.kind, c.name, c.unit, c.source_type, c.source_id,
            COALESCE(c.is_enabled, TRUE) AS is_enabled,
            c.system_id, c.group_id, c.area_id, c.service_id, c.custom_name, c.icon
     FROM capabilities c
     INNER JOIN devices d ON d.id = c.device_id
     ORDER BY c.name`
  );
  const statusLights = await loadCustomStatusSettings();
  return r.rows.map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    kind: row.kind,
    name: row.name,
    unit: row.unit,
    sourceType: row.source_type,
    sourceId: row.source_id,
    isEnabled: row.is_enabled,
    systemId: row.system_id,
    groupId: row.group_id,
    areaId: row.area_id,
    serviceId: row.service_id,
    customName: row.custom_name,
    icon: row.icon,
    ...(statusLights.has(row.id) ? { statusLight: statusLights.get(row.id) } : {}),
  }));
}

async function loadCapabilityBindings(): Promise<ExportedCapabilityBinding[]> {
  const r = await getPool().query<{
    id: string;
    capability_id: string;
    protocol: string;
    state_topic: string | null;
    command_topic: string | null;
    value_map: unknown;
  }>(
    `SELECT id, capability_id, protocol, state_topic, command_topic, value_map
     FROM capability_bindings`
  );
  return r.rows.map((row) => ({
    id: row.id,
    capabilityId: row.capability_id,
    protocol: row.protocol,
    stateTopic: row.state_topic,
    commandTopic: row.command_topic,
    valueMap:
      row.value_map && typeof row.value_map === "object" && !Array.isArray(row.value_map)
        ? (row.value_map as Record<string, unknown>)
        : {},
  }));
}

async function loadGroups(): Promise<ExportedGroup[]> {
  const r = await getPool().query<{
    id: string;
    area_id: string;
    system_id: string;
    name: string;
    sort_order: number;
    is_enabled: boolean;
  }>(
    `SELECT id, area_id, system_id, name, sort_order, COALESCE(is_enabled, TRUE) AS is_enabled
     FROM groups ORDER BY sort_order, name`
  );
  return r.rows.map((row) => ({
    id: row.id,
    areaId: row.area_id,
    systemId: row.system_id,
    name: row.name,
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled,
  }));
}

async function loadUsers(): Promise<ExportedUser[]> {
  const r = await getPool().query<{
    id: string;
    username: string;
    password_hash: string;
    display_name: string | null;
    is_active: boolean;
    role: string;
    theme_prefs: unknown;
    avatar_data: string | null;
  }>(
    `SELECT id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
     FROM users ORDER BY username`
  );
  return r.rows.map((row) => ({
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    isActive: row.is_active,
    role: row.role,
    themePrefs: row.theme_prefs ?? {},
    avatarData: row.avatar_data,
  }));
}

async function loadRoles(): Promise<ExportedRole[]> {
  const r = await getPool().query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    is_admin: boolean;
    is_system: boolean;
    sort_order: number;
    permissions: unknown;
  }>(`SELECT id, slug, name, description, is_admin, is_system, sort_order, permissions FROM roles`);
  return r.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isAdmin: row.is_admin,
    isSystem: row.is_system,
    sortOrder: row.sort_order,
    permissions: row.permissions ?? {},
  }));
}

async function loadOctopus(): Promise<ExportedOctopus | null> {
  const r = await getPool().query<{
    account_number: string;
    api_key: string;
    electricity_device_id: string;
    gas_device_id: string;
    gas_consumption_units: string;
    enabled: boolean;
    poll_interval_sec: number;
  }>(
    `SELECT account_number, api_key, electricity_device_id, gas_device_id,
            COALESCE(gas_consumption_units, '') AS gas_consumption_units,
            enabled, poll_interval_sec
     FROM octopus_settings WHERE id = 1`
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    accountNumber: row.account_number,
    apiKey: row.api_key,
    electricityDeviceId: row.electricity_device_id,
    gasDeviceId: row.gas_device_id,
    gasConsumptionUnits: row.gas_consumption_units,
    enabled: row.enabled,
    pollIntervalSec: row.poll_interval_sec,
  };
}

export async function exportDomain(): Promise<DomainExport> {
  const base = await buildConfigPayload();
  const [capabilities, capabilityBindings, groups, users, roles, octopus, plugins, bellTopics] =
    await Promise.all([
      loadCapabilities(),
      loadCapabilityBindings(),
      loadGroups(),
      loadUsers(),
      loadRoles(),
      loadOctopus(),
      loadPlugins(),
      getBellTopics(),
    ]);
  return sanitizeDomainExport({
    exportVersion: DOMAIN_EXPORT_VERSION,
    areas: base.rooms,
    devices: base.devices,
    dashboards: base.dashboards,
    cameras: base.cameras,
    capabilities,
    capabilityBindings,
    groups,
    users,
    roles,
    integrations: { octopus, plugins },
    bellTopics,
  });
}
