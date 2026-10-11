import { config } from "../config.js";
import { regenerateMosquittoPasswd } from "../backup/collect.js";
import { restartNexternelServices } from "../backup/post-restore.js";
import { syncMosquittoPasswdForInstallation } from "../migrate/ensure-mosquitto-credentials.js";
import { getMqttStatus, startTelemetry } from "../telemetry/mqtt.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Align Mosquitto passwd with .env and reconnect the API MQTT client. */
export async function repairMqttConnection(): Promise<{ ok: boolean; message: string }> {
  const username = config.mqttUsername().trim();
  const password = config.mqttPassword();
  if (!username || !password) {
    return {
      ok: false,
      message: "MQTT credentials are not configured for this installation.",
    };
  }

  const sync = await syncMosquittoPasswdForInstallation();
  if (!sync.ok) {
    const passwdOk = await regenerateMosquittoPasswd(username, password);
    if (!passwdOk) {
      return {
        ok: false,
        message: "Could not update the MQTT broker password file.",
      };
    }
  }

  const restart = await restartNexternelServices("mqtt");
  if (!restart.ok) {
    return {
      ok: false,
      message: `MQTT password updated but broker restart failed: ${restart.message}`,
    };
  }

  await sleep(2000);
  await startTelemetry();

  const mqtt = getMqttStatus();
  if (mqtt.status === "connected") {
    return { ok: true, message: "MQTT broker repaired and connected." };
  }

  return {
    ok: false,
    message:
      mqtt.lastError ||
      "MQTT broker was restarted. Wait a few seconds and refresh this page.",
  };
}
