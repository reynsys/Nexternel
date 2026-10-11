import path from "path";
import { config } from "../config.js";
import {
  listEsphomeFiles,
  writeFileEnsured,
  esphomeDir,
} from "../migrate/paths.js";
import {
  rewriteDeviceMqttYaml,
  rewriteEsphomeSecretsYaml,
} from "../migrate/esphome-rewrite.js";
import type { ExportedDevice } from "../migrate/types.js";

const IP_IN_TEXT = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;

export function detectBrokerIpFromSecretsYaml(content: string): string {
  for (const key of ["mqtt_broker", "mqtt_host", "broker"]) {
    const re = new RegExp(`^\\s*${key}\\s*:\\s*["']?([^"'\\s#]+)`, "im");
    const m = re.exec(content);
    if (m?.[1]) {
      const ip = m[1].match(IP_IN_TEXT)?.[0];
      if (ip) return ip;
    }
  }
  return content.match(IP_IN_TEXT)?.[0] ?? "";
}

export function detectBrokerIpFromEsphomeArchive(
  files: { rel: string; data: Buffer }[]
): string {
  const secrets = files.find((f) =>
    /secrets\.ya?ml$/i.test(path.basename(f.rel))
  );
  if (secrets) {
    return detectBrokerIpFromSecretsYaml(secrets.data.toString("utf8"));
  }
  return "";
}

export type EsphomeCutoverOpts = {
  oldBrokerIp: string;
  devices: Pick<ExportedDevice, "esphomeName" | "slug" | "mqttTopicPrefix">[];
  wifiSsid?: string;
  wifiPassword?: string;
};

/** Rewrite live ESPHome YAML on disk for this server's broker, MQTT login, and topic prefix. */
export function rewriteEsphomeForCurrentServer(opts: EsphomeCutoverOpts): number {
  const newBrokerIp = (config.serverIp() || "").trim();
  if (!newBrokerIp) {
    throw new Error("SERVER_IP is not set — cannot update ESPHome for this server.");
  }

  const mqttUser = config.mqttUsername();
  const mqttPass = config.mqttPassword();
  const topicRoot =
    (process.env.MQTT_TOPIC_PREFIX || "nexternel").trim() || "nexternel";

  const byStem = new Map<string, Pick<ExportedDevice, "mqttTopicPrefix">>();
  for (const d of opts.devices) {
    const stem = (d.esphomeName || d.slug || "").toLowerCase().trim();
    if (stem) byStem.set(stem, d);
  }

  let count = 0;
  for (const { rel, data } of listEsphomeFiles()) {
    if (rel.includes("..")) continue;
    if (rel.includes(".esphome/") || rel.endsWith(".bin")) continue;
    if (!/\.ya?ml$/i.test(rel)) continue;

    let text = data.toString("utf8");
    const base = path.basename(rel).toLowerCase();

    if (base === "secrets.yaml" || base === "secrets.yml") {
      text = rewriteEsphomeSecretsYaml(text, {
        brokerIp: newBrokerIp,
        mqttUsername: mqttUser,
        mqttPassword: mqttPass,
        wifiSsid: opts.wifiSsid,
        wifiPassword: opts.wifiPassword,
      });
    } else {
      const stem = path.basename(rel, path.extname(rel)).toLowerCase();
      const device = byStem.get(stem);
      if (device) {
        text = rewriteDeviceMqttYaml(text, {
          brokerIp: newBrokerIp,
          mqttUsername: mqttUser,
          mqttPassword: mqttPass,
          topicPrefix: device.mqttTopicPrefix,
        });
      }
    }

    writeFileEnsured(path.join(esphomeDir(), rel), text);
    count += 1;
  }

  return count;
}
