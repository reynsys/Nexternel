import { regenerateMosquittoPasswd } from "../backup/collect.js";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { config } from "../config.js";
import { mosquittoConfigDir } from "../backup/paths.js";
import { ensureDir } from "./paths.js";

const execFileAsync = promisify(execFile);

export type MosquittoCredentialSync = {
  ok: boolean;
  users: string[];
  error?: string;
};

/** Rebuild Mosquitto passwd from the installation MQTT user in .env. */
export async function syncMosquittoPasswdForInstallation(): Promise<MosquittoCredentialSync> {
  const username = config.mqttUsername().trim();
  const password = config.mqttPassword();

  if (!username || !password) {
    return {
      ok: false,
      users: [],
      error: "MQTT_USERNAME or MQTT_PASSWORD missing in environment",
    };
  }

  // Same safe path as backup restore: the old file stays until the new one exists.
  if (!(await regenerateMosquittoPasswd(username, password))) {
    return { ok: false, users: [], error: "mosquitto_passwd could not write a new password file" };
  }
  return { ok: true, users: [username] };
}

function passwdFileHasUser(passwdContent: string, username: string): boolean {
  return passwdContent
    .split("\n")
    .some((line) => line.trim().startsWith(`${username}:`));
}

export function mosquittoPasswdNeedsSync(): boolean {
  const username = config.mqttUsername().trim();
  if (!username || !config.mqttPassword()) return false;
  const passwdPath = path.join(mosquittoConfigDir(), "passwd");
  if (!fs.existsSync(passwdPath)) return true;
  const content = fs.readFileSync(passwdPath, "utf8");
  return !passwdFileHasUser(content, username);
}
