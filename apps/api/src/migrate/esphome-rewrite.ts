/**
 * Rewrite ESPHome secrets / device YAML for Adopt onto a new server.
 * Credentials always come from the NEW server's .env (runtime config).
 * topic_prefix comes from the adopted Nexternel device row (export DB).
 */

function quoteYamlScalar(value: string): string {
  if (value.startsWith("!secret ")) return value;
  if (/[:#{}[\],&*?|>!%@`]/.test(value) || /\s/.test(value) || value === "") {
    return JSON.stringify(value);
  }
  return value;
}

function setTopLevelKey(text: string, key: string, value: string): string {
  const re = new RegExp(`^(\\s*${key}\\s*:\\s*).*$`, "im");
  if (re.test(text)) {
    return text.replace(re, `$1${quoteYamlScalar(value)}`);
  }
  return `${text.replace(/\s*$/, "")}\n${key}: ${quoteYamlScalar(value)}\n`;
}

export function rewriteEsphomeSecretsYaml(
  content: string,
  opts: {
    brokerIp: string;
    mqttUsername: string;
    mqttPassword: string;
    wifiSsid?: string;
    wifiPassword?: string;
  }
): string {
  let out = content;
  const broker = opts.brokerIp.trim();
  out = setTopLevelKey(out, "mqtt_broker", broker);
  if (new RegExp(`^\\s*mqtt_host\\s*:`, "im").test(out)) {
    out = setTopLevelKey(out, "mqtt_host", broker);
  }
  if (opts.mqttUsername) {
    out = setTopLevelKey(out, "mqtt_username", opts.mqttUsername);
  }
  if (opts.mqttPassword) {
    out = setTopLevelKey(out, "mqtt_password", opts.mqttPassword);
  }
  if (opts.wifiSsid?.trim()) {
    out = setTopLevelKey(out, "wifi_ssid", opts.wifiSsid.trim());
  }
  if (opts.wifiPassword !== undefined && opts.wifiPassword !== "") {
    out = setTopLevelKey(out, "wifi_password", opts.wifiPassword);
  }
  return out;
}

/**
 * Patch the `mqtt:` block only (does not touch wifi password).
 * Aligns broker / user / pass / topic_prefix with the new server + adopted device.
 */
export function rewriteDeviceMqttYaml(
  content: string,
  opts: {
    brokerIp: string;
    mqttUsername: string;
    mqttPassword: string;
    topicPrefix: string;
  }
): string {
  const usesSecrets =
    /broker:\s*!secret\s+mqtt_/i.test(content) ||
    /password:\s*!secret\s+mqtt_/i.test(content);

  const updates: Record<string, string> = {
    topic_prefix: opts.topicPrefix.trim(),
  };

  if (usesSecrets) {
    updates.broker = "!secret mqtt_broker";
    updates.username = "!secret mqtt_username";
    updates.password = "!secret mqtt_password";
  } else {
    updates.broker = opts.brokerIp.trim();
    updates.username = opts.mqttUsername;
    updates.password = opts.mqttPassword;
  }

  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inMqtt = false;
  let mqttIndent = 0;
  const seen = new Set<string>();

  const flushMissing = (childIndent: string) => {
    for (const [key, value] of Object.entries(updates)) {
      if (!seen.has(key)) {
        out.push(`${childIndent}${key}: ${quoteYamlScalar(value)}`);
        seen.add(key);
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const header = /^(\s*)mqtt:\s*(?:#.*)?$/.exec(line);
    if (header) {
      if (inMqtt) flushMissing("  ");
      inMqtt = true;
      mqttIndent = header[1].length;
      seen.clear();
      out.push(line);
      continue;
    }

    if (inMqtt) {
      if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
        out.push(line);
        continue;
      }
      const keyLine = /^(\s*)([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(line);
      if (!keyLine) {
        out.push(line);
        continue;
      }
      const ind = keyLine[1].length;
      if (ind <= mqttIndent) {
        // Left the mqtt block — insert any missing keys first
        flushMissing(" ".repeat(mqttIndent + 2));
        inMqtt = false;
        out.push(line);
        continue;
      }
      const key = keyLine[2];
      if (updates[key] !== undefined) {
        out.push(`${keyLine[1]}${key}: ${quoteYamlScalar(updates[key]!)}`);
        seen.add(key);
        continue;
      }
      out.push(line);
      continue;
    }

    out.push(line);
  }

  if (inMqtt) {
    flushMissing(" ".repeat(mqttIndent + 2));
  }

  // No mqtt: block at all — append one
  if (!/^mqtt:\s*$/m.test(content) && !/^mqtt:\s*(?:#.*)?$/m.test(content)) {
    const block = [
      "mqtt:",
      `  broker: ${quoteYamlScalar(updates.broker!)}`,
      `  port: 1883`,
      `  username: ${quoteYamlScalar(updates.username!)}`,
      `  password: ${quoteYamlScalar(updates.password!)}`,
      `  topic_prefix: ${quoteYamlScalar(updates.topic_prefix!)}`,
      "  discovery: false",
      "",
    ].join("\n");
    return `${out.join("\n").replace(/\s*$/, "")}\n\n${block}`;
  }

  return out.join("\n");
}

/** Remap old broker IP string occurrences in device YAML (conservative). */
export function remapBrokerIpInYaml(
  content: string,
  oldIp: string,
  newIp: string
): string {
  const from = oldIp.trim();
  const to = newIp.trim();
  if (!from || !to || from === to) return content;
  return content.split(from).join(to);
}
