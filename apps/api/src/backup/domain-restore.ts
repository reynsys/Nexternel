import { normalizePluginBell } from "../notifications/service.js";
import { forgetBellTopics, normalizeBellTopics, normalizeOfflineMinutes } from "../notifications/topics.js";
import { encryptSecret } from "../plugins/secrets.js";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { syncCapabilitiesFromLegacy } from "../capabilities/sync.js";
import { syncAllCamerasToGo2rtc } from "../cameras/service.js";
import { refreshTelemetrySubscriptions } from "../telemetry/mqtt.js";
import { repairDashboardCapabilityBindings } from "../migrate/repair-dashboard-bindings.js";
import type { ConfigPayload } from "../migrate/types.js";
import {
  upsertCameras,
  upsertDashboards,
  upsertDevice,
  upsertRooms,
} from "../migrate/adopt-config.js";
import type { DomainExport } from "./domain-export.js";
import { sanitizeDomainForRestore } from "./domain-sanitize.js";

function pgErrMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: string }).message);
  }
  return err instanceof Error ? err.message : String(err);
}

function toConfigPayload(domain: DomainExport): ConfigPayload {
  return {
    rooms: domain.areas,
    devices: domain.devices,
    dashboards: domain.dashboards,
    cameras: domain.cameras,
  };
}

async function upsertRoles(client: PoolClient, domain: DomainExport) {
  for (const role of domain.roles) {
    const byId = await client.query<{ id: string }>(
      `SELECT id FROM roles WHERE id = $1::uuid`,
      [role.id]
    );
    const bySlug = await client.query<{ id: string }>(
      `SELECT id FROM roles WHERE slug = $1`,
      [role.slug]
    );

    const idRow = byId.rows[0];
    const slugRow = bySlug.rows[0];

    const values = [
      role.name,
      role.description,
      role.isAdmin,
      role.isSystem,
      role.sortOrder,
      JSON.stringify(role.permissions ?? {}),
    ];

    if (slugRow && (!idRow || slugRow.id !== role.id)) {
      // Fresh install seeds admin/viewer with new UUIDs — adopt by slug.
      await client.query(
        `UPDATE roles SET
           name = $2,
           description = $3,
           is_admin = $4,
           is_system = $5,
           sort_order = $6,
           permissions = $7::jsonb,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [slugRow.id, ...values]
      );
      continue;
    }

    if (idRow) {
      await client.query(
        `UPDATE roles SET
           slug = $2,
           name = $3,
           description = $4,
           is_admin = $5,
           is_system = $6,
           sort_order = $7,
           permissions = $8::jsonb,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [role.id, role.slug, ...values]
      );
      continue;
    }

    await client.query(
      `INSERT INTO roles (id, slug, name, description, is_admin, is_system, sort_order, permissions)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [role.id, role.slug, ...values]
    );
  }
}

async function upsertUsers(
  client: PoolClient,
  domain: DomainExport,
  opts?: { preserveAdminUsername?: string }
) {
  const preserve = opts?.preserveAdminUsername?.trim();
  for (const user of domain.users) {
    const byId = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE id = $1::uuid`,
      [user.id]
    );
    const byUsername = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE username = $1`,
      [user.username]
    );

    const idRow = byId.rows[0];
    const usernameRow = byUsername.rows[0];

    const values = [
      user.passwordHash,
      user.displayName,
      user.isActive,
      user.role,
      JSON.stringify(user.themePrefs ?? {}),
      user.avatarData,
    ];

    if (usernameRow && (!idRow || usernameRow.id !== user.id)) {
      if (preserve && user.username === preserve) {
        await client.query(
          `UPDATE users SET
             display_name = $2,
             is_active = $3,
             role = $4,
             theme_prefs = $5::jsonb,
             avatar_data = $6,
             updated_at = NOW()
           WHERE id = $1::uuid`,
          [
            usernameRow.id,
            user.displayName,
            user.isActive,
            user.role,
            JSON.stringify(user.themePrefs ?? {}),
            user.avatarData,
          ]
        );
        continue;
      }
      await client.query(
        `UPDATE users SET
           password_hash = $2,
           display_name = $3,
           is_active = $4,
           role = $5,
           theme_prefs = $6::jsonb,
           avatar_data = $7,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [usernameRow.id, ...values]
      );
      continue;
    }

    if (idRow) {
      if (preserve && user.username === preserve) {
        await client.query(
          `UPDATE users SET
             username = $2,
             display_name = $3,
             is_active = $4,
             role = $5,
             theme_prefs = $6::jsonb,
             avatar_data = $7,
             updated_at = NOW()
           WHERE id = $1::uuid`,
          [
            user.id,
            user.username,
            user.displayName,
            user.isActive,
            user.role,
            JSON.stringify(user.themePrefs ?? {}),
            user.avatarData,
          ]
        );
        continue;
      }
      await client.query(
        `UPDATE users SET
           username = $2,
           password_hash = $3,
           display_name = $4,
           is_active = $5,
           role = $6,
           theme_prefs = $7::jsonb,
           avatar_data = $8,
           updated_at = NOW()
         WHERE id = $1::uuid`,
        [user.id, user.username, ...values]
      );
      continue;
    }

    await client.query(
      `INSERT INTO users (
         id, username, password_hash, display_name, is_active, role, theme_prefs, avatar_data
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8
       )`,
      [user.id, user.username, ...values]
    );
  }
}

async function upsertGroups(client: PoolClient, domain: DomainExport) {
  for (const group of domain.groups) {
    await client.query(
      `INSERT INTO groups (id, area_id, system_id, name, sort_order, is_enabled)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         area_id = EXCLUDED.area_id,
         system_id = EXCLUDED.system_id,
         name = EXCLUDED.name,
         sort_order = EXCLUDED.sort_order,
         is_enabled = EXCLUDED.is_enabled,
         updated_at = NOW()`,
      [
        group.id,
        group.areaId,
        group.systemId,
        group.name,
        group.sortOrder,
        group.isEnabled,
      ]
    );
  }
}

async function upsertCapabilities(client: PoolClient, domain: DomainExport) {
  for (const cap of domain.capabilities) {
    try {
      await client.query(
        `INSERT INTO capabilities (
           id, device_id, kind, name, unit, source_type, source_id, is_enabled,
           system_id, group_id, area_id, service_id, custom_name, icon
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8,
           $9, $10::uuid, $11::uuid, $12, $13, $14
         )
         ON CONFLICT (id) DO UPDATE SET
           device_id = EXCLUDED.device_id,
           kind = EXCLUDED.kind,
           name = EXCLUDED.name,
           unit = EXCLUDED.unit,
           source_type = EXCLUDED.source_type,
           source_id = EXCLUDED.source_id,
           is_enabled = EXCLUDED.is_enabled,
           system_id = EXCLUDED.system_id,
           group_id = EXCLUDED.group_id,
           area_id = EXCLUDED.area_id,
           service_id = EXCLUDED.service_id,
           custom_name = EXCLUDED.custom_name,
           icon = EXCLUDED.icon,
           updated_at = NOW()`,
        [
          cap.id,
          cap.deviceId,
          cap.kind,
          cap.name,
          cap.unit,
          cap.sourceType,
          cap.sourceId,
          cap.isEnabled,
          cap.systemId,
          cap.groupId,
          cap.areaId,
          cap.serviceId,
          cap.customName ?? null,
          cap.icon ?? null,
        ]
      );
      if (cap.statusLight) {
        const sl = cap.statusLight;
        await client.query(
          `INSERT INTO capability_status_limits
             (capability_id, enabled, alert_low, watch_low, watch_high, alert_high, notify_after_min)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (capability_id) DO UPDATE SET
             enabled = EXCLUDED.enabled, alert_low = EXCLUDED.alert_low, watch_low = EXCLUDED.watch_low,
             watch_high = EXCLUDED.watch_high, alert_high = EXCLUDED.alert_high,
             notify_after_min = EXCLUDED.notify_after_min, updated_at = NOW()`,
          [
            cap.id,
            sl.enabled !== false,
            sl.limits?.alertLow ?? null,
            sl.limits?.watchLow ?? null,
            sl.limits?.watchHigh ?? null,
            sl.limits?.alertHigh ?? null,
            sl.notifyAfterMin ?? null,
          ]
        );
      } else {
        await client.query(`DELETE FROM capability_status_limits WHERE capability_id = $1::uuid`, [cap.id]);
      }
    } catch (err) {
      throw new Error(`Capability "${cap.name}" failed (${pgErrMessage(err)}).`);
    }
  }
}

async function upsertCapabilityBindings(client: PoolClient, domain: DomainExport) {
  for (const binding of domain.capabilityBindings) {
    await client.query(
      `INSERT INTO capability_bindings (
         id, capability_id, protocol, state_topic, command_topic, value_map
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb
       )
       ON CONFLICT (id) DO UPDATE SET
         capability_id = EXCLUDED.capability_id,
         protocol = EXCLUDED.protocol,
         state_topic = EXCLUDED.state_topic,
         command_topic = EXCLUDED.command_topic,
         value_map = EXCLUDED.value_map,
         updated_at = NOW()`,
      [
        binding.id,
        binding.capabilityId,
        binding.protocol,
        binding.stateTopic,
        binding.commandTopic,
        JSON.stringify(binding.valueMap ?? {}),
      ]
    );
  }
}

async function upsertOctopus(client: PoolClient, domain: DomainExport) {
  const octopus = domain.integrations.octopus;
  if (!octopus) return;
  await client.query(
    `INSERT INTO octopus_settings (
       id, account_number, api_key, electricity_device_id, gas_device_id,
       gas_consumption_units, enabled, poll_interval_sec
     ) VALUES (1, $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       account_number = EXCLUDED.account_number,
       api_key = EXCLUDED.api_key,
       electricity_device_id = EXCLUDED.electricity_device_id,
       gas_device_id = EXCLUDED.gas_device_id,
       gas_consumption_units = EXCLUDED.gas_consumption_units,
       enabled = EXCLUDED.enabled,
       poll_interval_sec = EXCLUDED.poll_interval_sec,
       updated_at = NOW()`,
    [
      octopus.accountNumber,
      octopus.apiKey,
      octopus.electricityDeviceId,
      octopus.gasDeviceId,
      octopus.gasConsumptionUnits,
      octopus.enabled,
      octopus.pollIntervalSec,
    ]
  );
}

/** Plugins come back set up; their files are downloaded again when the plugin container asks. */
async function upsertPlugins(client: PoolClient, domain: DomainExport, roomRemap: Map<string, string>) {
  for (const p of domain.integrations.plugins ?? []) {
    const settings: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(p.settings ?? {})) {
      if (value && typeof value === "object" && "secret" in value) {
        const plain = (value as { secret: unknown }).secret;
        if (typeof plain === "string") settings[key] = encryptSecret(plain);
      } else {
        settings[key] = value;
      }
    }
    const grants = { ...p.grants };
    if (Array.isArray(grants.read)) {
      grants.read = grants.read.map((id) => (typeof id === "string" ? roomRemap.get(id) ?? id : id));
    }
    await client.query(
      `INSERT INTO installed_plugins (id, enabled, builtin, source, package_path, manifest, grants, settings, status, token_hash, bell)
       VALUES ($1, $2, FALSE, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, 'waiting', NULL, $8)
       ON CONFLICT (id) DO UPDATE SET
         enabled = EXCLUDED.enabled, source = EXCLUDED.source, package_path = EXCLUDED.package_path,
         manifest = EXCLUDED.manifest, grants = EXCLUDED.grants, settings = EXCLUDED.settings, bell = EXCLUDED.bell,
         config_rev = installed_plugins.config_rev + 1, token_hash = NULL, updated_at = NOW()`,
      [
        p.id,
        p.enabled,
        p.source === "file" ? "file" : "catalog",
        `packages/${p.id}/${p.manifest.version}`,
        JSON.stringify(p.manifest),
        JSON.stringify(grants),
        JSON.stringify(settings),
        normalizePluginBell(p.bell),
      ]
    );
  }
}

export async function restoreDomain(
  domain: DomainExport,
  opts?: { preserveAdminUsername?: string }
): Promise<{
  skippedCapabilities: string[];
  skippedGroups: string[];
}> {
  const payload = toConfigPayload(domain);
  const client = await getPool().connect();
  let skippedCapabilities: string[] = [];
  let skippedGroups: string[] = [];
  try {
    await client.query("BEGIN");
    const roomRemap = await upsertRooms(client, payload);
    for (const d of payload.devices) {
      await upsertDevice(client, d, roomRemap);
    }
    const sanitized = sanitizeDomainForRestore(domain, roomRemap);
    skippedCapabilities = sanitized.skippedCapabilities;
    skippedGroups = sanitized.skippedGroups;
    const clean = sanitized.domain;
    await upsertGroups(client, clean);
    await upsertCapabilities(client, clean);
    await upsertCapabilityBindings(client, clean);
    // A restore replaces the home: drop areas the backup does not have (e.g. a fresh install's
    // starter rooms) — but only ones nothing uses, so nothing set up here is lost.
    const keptAreaIds = [...new Set(roomRemap.values())];
    await client.query(
      `DELETE FROM rooms r
        WHERE NOT (r.id = ANY($1::uuid[]))
          AND NOT EXISTS (SELECT 1 FROM devices d WHERE d.room_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM capabilities c WHERE c.area_id = r.id)
          AND NOT EXISTS (SELECT 1 FROM cameras cam WHERE cam.area_id = r.id)`,
      [keptAreaIds]
    );
    if (clean.capabilities.length > 0) {
      await client.query(`DELETE FROM capabilities WHERE NOT (id = ANY($1::uuid[]))`, [
        clean.capabilities.map((c) => c.id),
      ]);
    }
    await upsertDashboards(client, payload);
    await upsertCameras(client, payload, roomRemap);
    await upsertRoles(client, clean);
    await upsertUsers(client, clean, opts);
    await upsertOctopus(client, clean);
    await upsertPlugins(client, clean, roomRemap);
    // Older backups have no bell choices: the server keeps its own.
    if (clean.bellTopics) {
      const topics = normalizeBellTopics(clean.bellTopics);
      for (const [topic, enabled] of Object.entries(topics)) {
        await client.query(
          `INSERT INTO notification_topics (topic, enabled) VALUES ($1, $2) ON CONFLICT (topic) DO UPDATE SET enabled = EXCLUDED.enabled`,
          [topic, enabled]
        );
      }
      forgetBellTopics();
    }
    if (clean.bellOfflineMinutes !== undefined) {
      await client.query(
        `INSERT INTO notification_topics (topic, enabled, minutes) VALUES ('devices', TRUE, $1) ON CONFLICT (topic) DO UPDATE SET minutes = EXCLUDED.minutes`,
        [normalizeOfflineMinutes(clean.bellOfflineMinutes)]
      );
      forgetBellTopics();
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  try {
    await syncCapabilitiesFromLegacy();
    await repairDashboardCapabilityBindings();
    await refreshTelemetrySubscriptions();
    const { statusEngine } = await import("../capabilities/status-lights.js");
    await statusEngine.reload();
  } catch {
    /* next request will sync */
  }
  try {
    await syncAllCamerasToGo2rtc();
  } catch {
    /* go2rtc may be down */
  }

  return { skippedCapabilities, skippedGroups };
}
