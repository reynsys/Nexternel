import path from "path";
import { config } from "../config.js";
import { detectBrokerIpFromSecretsYaml } from "../backup/esphome-cutover.js";
import { rewriteEsphomeSecretsYaml } from "./esphome-rewrite.js";
import { esphomeDir, listEsphomeFiles, writeFileEnsured } from "./paths.js";

export type EnsureEsphomeSecretsResult = {
  serverIp: string;
  previousBrokerIp: string | null;
  updated: boolean;
};

/** Align esphome/secrets.yaml mqtt_broker with SERVER_IP after backup restore. */
export function ensureEsphomeSecretsForServer(): EnsureEsphomeSecretsResult {
  const serverIp = (config.serverIp() || "").trim();
  if (!serverIp) {
    return { serverIp: "", previousBrokerIp: null, updated: false };
  }

  for (const { rel, data } of listEsphomeFiles()) {
    if (!/secrets\.ya?ml$/i.test(rel)) continue;
    const text = data.toString("utf8");
    const previousBrokerIp = detectBrokerIpFromSecretsYaml(text) || null;
    if (previousBrokerIp === serverIp) {
      return { serverIp, previousBrokerIp, updated: false };
    }

    const updated = rewriteEsphomeSecretsYaml(text, {
      brokerIp: serverIp,
      mqttUsername: config.mqttUsername(),
      mqttPassword: config.mqttPassword(),
    });
    writeFileEnsured(path.join(esphomeDir(), rel), updated);
    return { serverIp, previousBrokerIp, updated: true };
  }

  return { serverIp, previousBrokerIp: null, updated: false };
}
