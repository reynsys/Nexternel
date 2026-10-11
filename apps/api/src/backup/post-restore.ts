import { execFile } from "child_process";
import { promisify } from "util";
import type { DomainExport } from "./domain-export.js";
import { applyLegacyTopicRootToPayload } from "../migrate/topic-remap.js";
import { collectOldTopicRoots } from "./topic-roots.js";

const execFileAsync = promisify(execFile);

export function remapDomainForCurrentServer(domain: DomainExport): DomainExport {
  const topicRoot =
    (process.env.MQTT_TOPIC_PREFIX || "nexternel").trim() || "nexternel";
  const legacyRoots = collectOldTopicRoots(
    undefined,
    domain.devices.map((d) => d.mqttTopicPrefix)
  ).filter((r) => r !== topicRoot);
  const remapped = applyLegacyTopicRootToPayload(
    {
      rooms: domain.areas,
      devices: domain.devices,
      dashboards: domain.dashboards,
      cameras: domain.cameras,
    },
    topicRoot,
    legacyRoots
  );
  return {
    ...domain,
    areas: remapped.rooms,
    devices: remapped.devices,
    dashboards: remapped.dashboards,
    cameras: remapped.cameras,
  };
}

export type RestartableService = "mqtt" | "api" | "all" | "restored-services";

const SERVICE_CONTAINERS: Record<Exclude<RestartableService, "all" | "restored-services">, string> = {
  mqtt: "nexternel-mosquitto",
  api: "nexternel-api",
};

function containersForService(service: RestartableService): string[] {
  if (service === "restored-services") {
    // ESPHome reads the MQTT login from the restored device files only when it starts.
    return [SERVICE_CONTAINERS.mqtt, "nexternel-esphome"];
  }
  if (service === "all") {
    return [SERVICE_CONTAINERS.mqtt, SERVICE_CONTAINERS.api];
  }
  return [SERVICE_CONTAINERS[service]];
}

export async function restartNexternelServices(
  service: RestartableService = "all"
): Promise<{ ok: boolean; message: string }> {
  if (process.env.ALLOW_DOCKER_RESTART !== "true") {
    return {
      ok: false,
      message:
        "Automatic service restart is not enabled. Contact your installer or enable it in docker-compose.",
    };
  }
  const containers = containersForService(service);
  try {
    await execFileAsync("docker", ["restart", ...containers], {
      timeout: 120_000,
    });
    const label =
      service === "all" || service === "restored-services"
        ? "Nexternel services"
        : service === "mqtt"
          ? "MQTT broker"
          : "Nexternel API";
    return { ok: true, message: `${label} restarted.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

/**
 * Restart the services that load restored files (MQTT broker, ESPHome) — requires docker.sock.
 * Never the API: it is running the restore job; restarting it killed the job before
 * verification and left the restore "in progress" forever. The API reconnects to MQTT itself.
 */
export async function restartStackAfterRestore(): Promise<{
  ok: boolean;
  message: string;
}> {
  return restartNexternelServices("restored-services");
}
