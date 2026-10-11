import { listEsphomeFiles } from "./paths.js";

export type EsphomeMqttCredential = {
  username: string;
  password: string;
  source: string;
};

function parseYamlScalarLine(text: string, key: string): string | null {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*["']?([^"'\\n#!]+)["']?\\s*$`, "im");
  const m = re.exec(text);
  const value = m?.[1]?.trim() ?? null;
  if (!value || value.startsWith("!secret")) return null;
  return value;
}

/** Parse one ESPHome YAML file for mqtt_username / mqtt_password (or mqtt: username). */
export function extractEsphomeMqttCredential(
  rel: string,
  text: string
): EsphomeMqttCredential | null {
  if (!/\.ya?ml$/i.test(rel)) return null;

  let username = parseYamlScalarLine(text, "mqtt_username");
  let password = parseYamlScalarLine(text, "mqtt_password");

  if (!username) {
    username = parseYamlScalarLine(text, "username");
  }
  if (!password) {
    password = parseYamlScalarLine(text, "password");
  }

  if (username && password) {
    return { username, password, source: rel };
  }
  return null;
}

/** MQTT logins baked into ESPHome YAML on disk (substitutions or secrets). */
export function detectEsphomeMqttCredentials(): EsphomeMqttCredential[] {
  const byUser = new Map<string, EsphomeMqttCredential>();

  for (const { rel, data } of listEsphomeFiles()) {
    const cred = extractEsphomeMqttCredential(rel, data.toString("utf8"));
    if (cred) byUser.set(cred.username, cred);
  }

  return [...byUser.values()];
}

export function primaryEsphomeDeviceMqttUsername(): string | null {
  return detectEsphomeMqttCredentials()[0]?.username ?? null;
}
