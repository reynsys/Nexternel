/**
 * Parse Shelly Gen1 and Gen2/Gen3 MQTT status notifications.
 *
 * Gen2/Gen3: physical switches and the Shelly app typically publish NotifyStatus on
 * `{prefix}/events/rpc` (rpc_ntf, default true). The control-interface topic
 * `{prefix}/status/switch:N` is only pushed automatically when status_ntf is
 * enabled (default false), or after an MQTT control command / status_update.
 *
 * Gen1: relay state on `shellies/{id}/relay/N` with plain `on`/`off` payloads.
 */

export type ShellySwitchOutputUpdate = {
  /** e.g. "switch:0" or "relay:0" */
  componentKey: string;
  output: boolean;
};

function asSwitchOutput(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const output = (value as { output?: unknown }).output;
  return typeof output === "boolean" ? output : null;
}

function parseGen1RelayPayload(payload: string): boolean | null {
  const raw = payload.trim();
  const u = raw.toUpperCase();
  if (u === "ON" || u === "TRUE" || u === "1") return true;
  if (u === "OFF" || u === "FALSE" || u === "0") return false;
  return null;
}

/** Extract switch:N → output from a NotifyStatus or full GetStatus-like object. */
export function extractShellySwitchOutputsFromParams(
  params: Record<string, unknown>
): ShellySwitchOutputUpdate[] {
  const out: ShellySwitchOutputUpdate[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!/^switch:\d+$/i.test(key)) continue;
    const output = asSwitchOutput(value);
    if (output === null) continue;
    out.push({ componentKey: key.toLowerCase(), output });
  }
  return out;
}

/**
 * Parse a Shelly MQTT payload for switch output changes.
 * Returns [] when the topic/payload is not a Shelly status notification we handle.
 */
export function parseShellyMqttSwitchUpdates(
  topic: string,
  payload: string
): ShellySwitchOutputUpdate[] {
  const raw = payload.trim();
  if (!raw) return [];

  // Gen1: shellies/{id}/relay/N (not …/command)
  const gen1Relay = /\/relay\/(\d+)$/i.exec(topic);
  if (gen1Relay && !/\/command$/i.test(topic)) {
    const output = parseGen1RelayPayload(raw);
    if (output === null) return [];
    return [{ componentKey: `relay:${gen1Relay[1]}`, output }];
  }

  // Control-interface component status: …/status/switch:0
  const componentStatus = /\/status\/(switch:\d+)$/i.exec(topic);
  if (componentStatus) {
    if (!raw.startsWith("{")) return [];
    try {
      const obj = JSON.parse(raw) as { output?: unknown };
      if (typeof obj.output === "boolean") {
        return [
          {
            componentKey: componentStatus[1].toLowerCase(),
            output: obj.output,
          },
        ];
      }
    } catch {
      return [];
    }
    return [];
  }

  // Full device status (response to status_update on …/command)
  if (/\/status$/i.test(topic) && raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      return extractShellySwitchOutputsFromParams(obj);
    } catch {
      return [];
    }
  }

  // RPC notifications (physical switch / Shelly app / cloud) — default path
  if (!/\/events\/rpc$/i.test(topic) || !raw.startsWith("{")) return [];
  try {
    const msg = JSON.parse(raw) as {
      method?: string;
      params?: Record<string, unknown>;
    };
    if (msg.method !== "NotifyStatus" || !msg.params) return [];
    return extractShellySwitchOutputsFromParams(msg.params);
  } catch {
    return [];
  }
}

export function looksLikeShellyEventsTopic(topic: string): boolean {
  return /\/events\/rpc$/i.test(topic);
}
