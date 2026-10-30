import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { config } from "./config.js";
import { attachUser } from "./auth/plugin.js";
import { ensureCapabilitySchema } from "./capabilities/ensure-schema.js";
import { ensureStatusLightSchema, statusEngine } from "./capabilities/status-lights.js";
import { ensureV4DomainSchema } from "./systems/ensure-schema.js";
import { ensureDashboardSchema } from "./dashboards/ensure-schema.js";
import { ensureCameraSchema } from "./cameras/ensure-schema.js";
import { ensureOctopusSchema } from "./octopus/ensure-schema.js";
import { ensureBackupScheduleSchema, startBackupScheduler } from "./backup/scheduled.js";
import { ensureDevicesSchema , repairAutoSensorNames } from "./devices/ensure-schema.js";
import { ensureEsphomeBuilderSchema } from "./devices/ensure-esphome-builder-schema.js";
import { syncAllCamerasToGo2rtc } from "./cameras/service.js";
import { ensureUsersRoleSchema } from "./auth/ensure-users-role.js";
import { ensureUsersThemeSchema } from "./auth/ensure-users-theme.js";
import { ensureUsersAvatarSchema } from "./auth/ensure-users-avatar.js";
import { ensureRolesSchema } from "./auth/ensure-roles-schema.js";
import { ensureAdminFromEnv } from "./auth/ensure-admin.js";
import { bootstrapInstallationState, getUserCount } from "./installation-meta.js";
import { syncCapabilitiesFromLegacy } from "./capabilities/sync.js";
import { startTelemetry } from "./telemetry/mqtt.js";
import { healthRoutes } from "./routes/health.js";
import { diagnosticsRoutes } from "./routes/diagnostics.js";
import { authRoutes } from "./routes/auth.js";
import { roomsRoutes } from "./routes/rooms.js";
import { devicesRoutes } from "./routes/devices.js";
import { camerasRoutes } from "./routes/cameras.js";
import { capabilitiesRoutes } from "./routes/capabilities.js";
import { dashboardsRoutes } from "./dashboards/routes.js";
import { historyRoutes } from "./routes/history.js";
import { usersRoutes } from "./routes/users.js";
import { rolesRoutes } from "./routes/roles.js";
import { systemRoutes } from "./routes/system.js";
import { migrateRoutes } from "./migrate/routes.js";
import { backupRoutes } from "./backup/routes.js";
import { setupRoutes } from "./routes/setup.js";
import { weatherRoutes } from "./routes/weather.js";
import { shellyRoutes } from "./routes/shelly.js";
import { octopusRoutes } from "./routes/octopus.js";
import { pluginsRoutes } from "./routes/plugins.js";
import { addonsRoutes } from "./routes/addons.js";
import { ensureAddonSchema, startAddonChecks } from "./addons/service.js";
import { ensurePluginSchema } from "./plugins/ensure-schema.js";
import { pluginDoorwayRoutes } from "./plugins/doorway.js";
import { pluginHostRoutes } from "./plugins/host-routes.js";
import { pluginPanelRoutes } from "./plugins/panels.js";
import { ensureHostKey } from "./plugins/packages.js";
import { notificationsRoutes } from "./notifications/routes.js";
import { updateRoutes } from "./system/update-routes.js";
import { httpsRoutes } from "./system/https-routes.js";
import { applyHttps } from "./system/https.js";
import { ensureUpdateSchema, startUpdateChecks } from "./system/updates.js";
import { startSelfCheck } from "./system/self-check.js";
import { esphomeGateRoutes } from "./esphome/gate.js";
import { maintenanceGuard } from "./system/maintenance.js";
import { v4Routes } from "./v4/routes.js";
import { panelApiRoutes } from "./panels/api-routes.js";
import { wsRoutes } from "./telemetry/ws.js";
import { changeTopicFor, publishChange } from "./live/changes.js";
import { APP_VERSION } from "./version.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true,
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Nexternel-Token",
    "X-Nexternel-Client",
  ],
});

await app.register(cookie);

await app.register(rateLimit, {
  global: false,
});

/**
 * Register routes in one context with the auth hook.
 * (Sibling `register(authPlugin)` hooks do NOT apply to sibling route plugins
 * because of Fastify encapsulation — that caused empty verifyFailures.)
 */
await app.register(async (api) => {
  api.addHook("onRequest", async (request) => {
    await attachUser(request);
  });
  // While Nexternel is updating or restoring, changes are refused (reading and switching still work).
  api.addHook("preHandler", maintenanceGuard);
  // Every successful change is announced to all open screens, which then show it straight away.
  api.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode >= 400) return;
    const topic = changeTopicFor(request.method, request.url);
    if (!topic) return;
    const client = request.headers["x-nexternel-client"];
    publishChange(topic, { userId: request.user?.id ?? null, client: typeof client === "string" ? client.slice(0, 64) : null });
  });
  await api.register(multipart, {
    limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
  });
  await api.register(healthRoutes);
  await api.register(diagnosticsRoutes);
  await api.register(authRoutes);
  await api.register(roomsRoutes);
  await api.register(devicesRoutes);
  await api.register(camerasRoutes);
  await api.register(capabilitiesRoutes);
  await api.register(dashboardsRoutes);
  await api.register(historyRoutes);
  await api.register(usersRoutes);
  await api.register(rolesRoutes);
  await api.register(systemRoutes);
  await api.register(pluginsRoutes);
  await api.register(addonsRoutes);
  await api.register(pluginDoorwayRoutes);
  await api.register(pluginHostRoutes);
  await api.register(pluginPanelRoutes);
  await api.register(notificationsRoutes);
  await api.register(esphomeGateRoutes);
  await api.register(updateRoutes);
  await api.register(httpsRoutes);
  await api.register(migrateRoutes);
  await api.register(backupRoutes);
  await api.register(setupRoutes);
  await api.register(weatherRoutes);
  await api.register(shellyRoutes);
  await api.register(octopusRoutes);
  await api.register(panelApiRoutes, { apiVersion: "v5" });
  await api.register(v4Routes);
  await api.register(wsRoutes);
});

app.get("/", async (_request, reply) => {
  return reply.redirect("/api/v1/health");
});

try {
  await ensureUsersRoleSchema();
  await ensureUsersThemeSchema();
  await ensureUsersAvatarSchema();
  await ensureRolesSchema();
  await ensureDevicesSchema();
  // Readable names for readings named automatically before (e.g. "Pm 2 5" → "PM2.5").
  await repairAutoSensorNames();
  await ensureEsphomeBuilderSchema();
  await ensureCapabilitySchema();
  await ensureStatusLightSchema();
  const v4Domain = await ensureV4DomainSchema();
  app.log.info(v4Domain, "V4 domain schema ensured");
  await ensureDashboardSchema();
  await ensurePluginSchema();
  await ensureAddonSchema();
  try {
    await ensureHostKey();
  } catch (err) {
    app.log.warn({ err }, "plugin folder not writable — plugins cannot run");
  }
  await ensureUpdateSchema();
  await ensureCameraSchema();
  await ensureOctopusSchema();
  await ensureBackupScheduleSchema();
  const { refreshHostIpAtStartup } = await import("./system/host-ip.js");
  const hostIp = await refreshHostIpAtStartup();
  app.log.info({ hostIp, envServerIp: process.env.SERVER_IP || null }, "server address on the home network");
  // The secure front door (Caddy) needs the server's address for its certificate.
  void applyHttps(true)
    .then((problem) => (problem ? app.log.warn({ problem }, "secure connection") : app.log.info("secure connection configured")))
    .catch((err) => app.log.warn({ err }, "secure connection not configured"));
  const installState = await bootstrapInstallationState();
  app.log.info(installState, "installation bootstrap");
  let adminSeed: "created" | "exists" | "skipped" = "skipped";
  // ADMIN_USERNAME / ADMIN_PASSWORD only rescue an installation that has no users at all.
  // Once the setup wizard has created the administrator, never add a second (hidden) admin.
  if (!installState.needsSetup && (await getUserCount()) === 0) {
    adminSeed = await ensureAdminFromEnv();
  }
  app.log.info({ adminSeed, needsSetup: installState.needsSetup }, "admin bootstrap");
  try {
    const { ensureEsphomeSecretsForServer } = await import(
      "./migrate/ensure-esphome-secrets.js"
    );
    const secrets = ensureEsphomeSecretsForServer();
    if (secrets.updated) {
      app.log.warn(
        secrets,
        "esphome/secrets.yaml mqtt_broker updated to SERVER_IP after stale backup restore"
      );
    }
  } catch (err) {
    app.log.warn({ err }, "ESPHome secrets alignment skipped");
  }
  try {
    const { syncMosquittoPasswdForInstallation, mosquittoPasswdNeedsSync } =
      await import("./migrate/ensure-mosquitto-credentials.js");
    const { restartNexternelServices } = await import("./backup/post-restore.js");
    if (mosquittoPasswdNeedsSync()) {
      const mqttCreds = await syncMosquittoPasswdForInstallation();
      if (mqttCreds.ok) {
        app.log.warn(
          { users: mqttCreds.users },
          "Mosquitto passwd created/updated from .env"
        );
        const restart = await restartNexternelServices("mqtt");
        if (!restart.ok) {
          app.log.error({ restart }, "Mosquitto restart after passwd sync failed");
        }
      } else {
        app.log.error({ error: mqttCreds.error }, "Mosquitto passwd sync FAILED");
      }
    }
  } catch (err) {
    app.log.warn({ err }, "Mosquitto credential sync skipped");
  }
  try {
    const { reconcileAllEsphomeDevicesFromYaml } = await import(
      "./devices/service.js"
    );
    const { pruneInternalRelayRows } = await import(
      "./capabilities/cleanup.js"
    );
    const reconciled = await reconcileAllEsphomeDevicesFromYaml();
    const prunedInternal = await pruneInternalRelayRows();
    if (
      reconciled.reconciled > 0 ||
      reconciled.errors > 0 ||
      prunedInternal > 0
    ) {
      app.log.info(
        { reconciled, prunedInternal },
        "ESPHome YAML reconcile / internal relay prune"
      );
    }
  } catch (err) {
    app.log.warn({ err }, "ESPHome YAML reconcile skipped");
  }
  try {
    const { startEsphomeOrphanPruneLoop } = await import("./esphome/orphan-prune.js");
    startEsphomeOrphanPruneLoop(app.log);
  } catch (err) {
    app.log.warn({ err }, "ESPHome orphan prune scheduler skipped");
  }
  const synced = await syncCapabilitiesFromLegacy();
  if (
    synced.topicAlignment.devicesUpdated > 0 ||
    synced.topicAlignment.sensorsUpdated > 0 ||
    synced.topicAlignment.relaysUpdated > 0
  ) {
    app.log.info(synced.topicAlignment, "MQTT topics aligned to installation prefix");
  }
  if (
    synced.topicNormalization.sensorsUpdated > 0 ||
    synced.topicNormalization.relaysUpdated > 0
  ) {
    app.log.info(synced.topicNormalization, "ESPHome MQTT topics normalized from entity ids");
  }
  if (
    synced.shellyPrefixMigration.devicesUpdated > 0 ||
    synced.shellyPrefixMigration.relaysUpdated > 0
  ) {
    app.log.info(synced.shellyPrefixMigration, "Shelly device MQTT prefixes migrated");
  }
  if (synced.bindingRepair.sensors > 0 || synced.bindingRepair.relays > 0) {
    app.log.info(synced.bindingRepair, "capability bindings repaired from sensor/relay topics");
  }
  app.log.info(synced, "capabilities synced from sensors/relays");
  try {
    const { getOctopusSettings, ensureOctopusDeviceAndSensors } = await import(
      "./octopus/service.js"
    );
    const { triggerOctopusPoll } = await import("./octopus/poll.js");
    const oct = await getOctopusSettings();
    if (oct?.enabled && oct.api_key.trim() && oct.account_number.trim()) {
      await ensureOctopusDeviceAndSensors();
      await syncCapabilitiesFromLegacy();
      await triggerOctopusPoll(true);
      app.log.info("octopus integration startup poll completed");
    }
  } catch (err) {
    app.log.warn({ err }, "octopus startup poll skipped");
  }
  try {
    const { repairDashboardCapabilityBindings } = await import(
      "./migrate/repair-dashboard-bindings.js"
    );
    const repaired = await repairDashboardCapabilityBindings();
    if (repaired.bindingsRemapped > 0 || repaired.dashboardsUpdated > 0) {
      app.log.info(repaired, "dashboard capability bindings repaired");
    }
  } catch (err) {
    app.log.warn({ err }, "dashboard binding repair skipped");
  }
  try {
    const camSync = await syncAllCamerasToGo2rtc();
    app.log.info(camSync, "cameras synced to go2rtc");
  } catch (err) {
    app.log.warn({ err }, "go2rtc camera sync skipped (is go2rtc up?)");
  }
  await startTelemetry();
  app.log.info(getMqttLogSafe(), "telemetry started");
  try {
    await statusEngine.start();
  } catch (err) {
    app.log.warn({ err }, "status lights skipped");
  }
  const { startOctopusPoller } = await import("./octopus/poll.js");
  startOctopusPoller();
  startUpdateChecks();
  startAddonChecks();
  startBackupScheduler(app.log);
  startSelfCheck(app.log);
  app.log.info("octopus poller started");

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Nexternel API ${APP_VERSION} listening on ${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

function getMqttLogSafe() {
  return { broker: config.mqttBroker() };
}
