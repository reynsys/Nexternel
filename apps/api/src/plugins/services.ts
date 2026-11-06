import { execFile } from "child_process";
import { promisify } from "util";
import type { PluginManifest } from "@nexternel/plugin-sdk";
import { getPool } from "../db.js";
import { hostFolder, UPDATER_IMAGE } from "../system/updates.js";

const execFileAsync = promisify(execFile);

/**
 * Optional parts of Nexternel that a plugin brings to life when it is installed, so nobody needs a
 * terminal. Only the parts listed here can be started; a plugin cannot name anything else.
 */
export const PLUGIN_SERVICES: Record<string, { compose: string[]; marker: string }> = {
  gps: { compose: ["traccar-db", "traccar", "traccar-cleanup"], marker: "nexternel-traccar" },
};

/** Runs beside Nexternel, because changing containers from inside one would cut itself off. */
async function runOnHost(name: string, script: string): Promise<void> {
  if (process.env.ALLOW_DOCKER_RESTART !== "true") return;
  const host = await hostFolder();
  await execFileAsync(
    "docker",
    [
      "run", "-d", "--rm", "--name", `nexternel-service-${name}`, "--network", "host",
      "-v", "/var/run/docker.sock:/var/run/docker.sock",
      "-v", `${host}:${host}`, "-w", host,
      UPDATER_IMAGE, "sh", "-c", script,
    ],
    { timeout: 60_000 }
  );
}

/** .env remembers the choice, so updates keep the service. */
const rememberProfile = (profile: string) =>
  [
    "OWNER=$(stat -c %u:%g .env)",
    `grep -q '^COMPOSE_PROFILES=' .env || echo 'COMPOSE_PROFILES=${profile}' >> .env`,
    'chown "$OWNER" .env',
  ].join("\n");

const forgetProfile = () =>
  ["OWNER=$(stat -c %u:%g .env)", "sed -i '/^COMPOSE_PROFILES=/d' .env", 'chown "$OWNER" .env'].join("\n");

export async function startPluginServices(manifest: PluginManifest): Promise<void> {
  for (const profile of manifest.services ?? []) {
    const service = PLUGIN_SERVICES[profile];
    if (!service) continue;
    await runOnHost(
      `start-${profile}`,
      [rememberProfile(profile), `docker compose --profile ${profile} up -d --no-recreate ${service.compose.join(" ")}`].join("\n")
    );
  }
}

/** Stops the service; what it stored stays on the server, in case the plugin comes back. */
export async function stopPluginServices(manifest: PluginManifest): Promise<void> {
  for (const profile of manifest.services ?? []) {
    const service = PLUGIN_SERVICES[profile];
    if (!service) continue;
    await runOnHost(
      `stop-${profile}`,
      [`docker compose --profile ${profile} rm -sf ${service.compose.join(" ")}`, forgetProfile()].join("\n")
    );
  }
}

/** After a restore on a new server the plugin is back but its service is not. */
export async function ensurePluginServicesAtStart(): Promise<void> {
  const res = await getPool().query<{ manifest: PluginManifest }>(`SELECT manifest FROM installed_plugins WHERE enabled`);
  for (const { manifest } of res.rows) {
    for (const profile of manifest.services ?? []) {
      const service = PLUGIN_SERVICES[profile];
      if (!service) continue;
      const { stdout } = await execFileAsync("docker", ["ps", "-a", "--filter", `name=^${service.marker}$`, "--format", "{{.Names}}"], {
        timeout: 20_000,
      });
      if (!stdout.trim()) await startPluginServices({ ...manifest, services: [profile] });
    }
  }
}
