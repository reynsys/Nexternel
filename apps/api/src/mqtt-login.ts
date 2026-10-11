/**
 * The MQTT login this installation uses. Normally MQTT_USERNAME / MQTT_PASSWORD from .env; after a
 * restore from another server, the old server's login is kept in `nexternel-mqtt-login.json` beside
 * the broker password file, so devices flashed for the old server reconnect without re-flashing.
 */
import fs from "fs";
import path from "path";

export type MqttLogin = { username: string; password: string };

function loginFile(): string {
  return path.join(process.env.MOSQUITTO_CONFIG_DIR || "/mosquitto-config", "nexternel-mqtt-login.json");
}

/** The login carried over from a restored backup, or null when this installation uses .env. */
export function readCarriedMqttLogin(): MqttLogin | null {
  try {
    const raw = JSON.parse(fs.readFileSync(loginFile(), "utf8")) as Partial<MqttLogin>;
    const username = typeof raw.username === "string" ? raw.username.trim() : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    return username && password ? { username, password } : null;
  } catch {
    return null;
  }
}

/** Keep the restored backup's MQTT login so its devices keep working on this server. */
export function writeCarriedMqttLogin(login: MqttLogin): void {
  const file = loginFile();
  const tmp = `${file}.new-${process.pid}`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ username: login.username.trim(), password: login.password }), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
