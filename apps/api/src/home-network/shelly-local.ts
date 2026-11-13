/**
 * Talking to a Shelly on the home network through its own web address (no cloud):
 * Gen 2+ (Plus, Pro, Gen 3, Gen 4) through its RPC calls, Gen 1 through its settings pages.
 * Used by Search my home → Bring in to point the switch at Nexternel's message service.
 */
import { createHash, randomBytes } from "node:crypto";

export class ShellyPasswordNeeded extends Error {
  constructor(wrong: boolean) {
    super(wrong ? "That password didn't work for this switch." : "This switch has a password. Type it to bring it in.");
  }
}

export class ShellyUnreachable extends Error {}

const TIMEOUT_MS = 6000;

async function send(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ShellyUnreachable("The switch didn't answer. Check it has power and is on your home Wi-Fi, then try again.");
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** The Authorization header for a Gen 2+ digest challenge (user is always "admin"). */
export function shellyDigestHeader(challenge: string, password: string, method: string, uri: string, cnonce?: string): string {
  const field = (k: string) => new RegExp(`${k}="?([^",]+)"?`, "i").exec(challenge)?.[1] ?? "";
  const realm = field("realm");
  const nonce = field("nonce");
  const nc = "00000001";
  const cn = cnonce ?? randomBytes(8).toString("hex");
  const ha1 = sha256(`admin:${realm}:${password}`);
  const ha2 = sha256(`${method}:${uri}`);
  const response = sha256(`${ha1}:${nonce}:${nc}:${cn}:auth:${ha2}`);
  return `Digest username="admin", realm="${realm}", nonce="${nonce}", uri="${uri}", cnonce="${cn}", nc=${nc}, qop=auth, response="${response}", algorithm=SHA-256`;
}

/** One Gen 2+ RPC call; handles the password challenge. */
export async function shellyRpc<T>(ip: string, method: string, params: unknown, password?: string): Promise<T> {
  const url = `http://${ip}/rpc`;
  const body = JSON.stringify({ id: 1, method, params: params ?? {} });
  const headers: Record<string, string> = { "content-type": "application/json" };
  let res = await send(url, { method: "POST", body, headers });
  if (res.status === 401) {
    const challenge = res.headers.get("www-authenticate") ?? "";
    if (!password) throw new ShellyPasswordNeeded(false);
    res = await send(url, {
      method: "POST",
      body,
      headers: { ...headers, authorization: shellyDigestHeader(challenge, password, "POST", "/rpc") },
    });
    if (res.status === 401) throw new ShellyPasswordNeeded(true);
  }
  const json = (await res.json().catch(() => null)) as { result?: T; error?: { message?: string } } | null;
  if (!res.ok || !json || json.error) {
    throw new Error(`The switch refused the change (${json?.error?.message ?? res.status}).`);
  }
  return json.result as T;
}

/** One Gen 1 page (settings are changed with query strings); basic password with user "admin". */
export async function shellyGen1Get<T>(ip: string, pathAndQuery: string, password?: string): Promise<T> {
  const url = `http://${ip}${pathAndQuery}`;
  const headers: Record<string, string> = {};
  if (password) headers.authorization = `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
  const res = await send(url, { headers });
  if (res.status === 401) throw new ShellyPasswordNeeded(Boolean(password));
  if (!res.ok) throw new Error(`The switch refused the change (${res.status}).`);
  return (await res.json()) as T;
}

export type ShellyFacts = {
  gen: 1 | 2;
  /** The id the switch uses in its messages (Gen 1: shelly1-ABC123; Gen 2+: shellyplus1-abc...). */
  id: string;
  mac: string | null;
  name: string | null;
  model: string | null;
  switchCount: number;
};

/** What the switch says about itself. Gen 1 answers /shelly without a password. */
export async function readShelly(ip: string, password?: string): Promise<ShellyFacts> {
  // Gen 1 and Gen 2+ both answer /shelly; Gen 2+ adds "gen".
  const res = await send(`http://${ip}/shelly`);
  const info = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!info) throw new ShellyUnreachable("This doesn't look like a Shelly switch.");
  if (typeof info.gen === "number" && info.gen >= 2) {
    const status = await shellyRpc<Record<string, unknown>>(ip, "Shelly.GetStatus", {}, password);
    const sys = await shellyRpc<{ device?: { name?: string | null } }>(ip, "Sys.GetConfig", {}, password);
    const switches = Object.keys(status).filter((k) => /^switch:\d+$/.test(k)).length;
    return {
      gen: 2,
      id: String(info.id ?? ""),
      mac: typeof info.mac === "string" ? info.mac : null,
      name: sys.device?.name?.trim() || null,
      model: typeof info.model === "string" ? info.model : null,
      switchCount: Math.max(1, switches),
    };
  }
  const settings = await shellyGen1Get<{
    device?: { hostname?: string; mac?: string; num_outputs?: number; type?: string };
    name?: string | null;
    relays?: unknown[];
  }>(ip, "/settings", password);
  return {
    gen: 1,
    id: settings.device?.hostname ?? "",
    mac: settings.device?.mac ?? (typeof info.mac === "string" ? info.mac : null),
    name: settings.name?.trim() || null,
    model: settings.device?.type ?? (typeof info.type === "string" ? info.type : null),
    switchCount: Math.max(1, settings.device?.num_outputs ?? settings.relays?.length ?? 1),
  };
}

export type MessageService = { host: string; port: number; username: string; password: string };

/**
 * Point the switch at Nexternel's message service and restart it.
 * Returns the address of another message service it used before, if any (it stops using that).
 */
export async function pointShellyAtNexternel(
  ip: string,
  facts: ShellyFacts,
  service: MessageService,
  password?: string
): Promise<{ previousServer: string | null }> {
  const server = `${service.host}:${service.port}`;
  if (facts.gen === 2) {
    const before = await shellyRpc<{ enable?: boolean; server?: string | null }>(ip, "Mqtt.GetConfig", {}, password);
    await shellyRpc(
      ip,
      "Mqtt.SetConfig",
      {
        config: {
          enable: true,
          server,
          user: service.username,
          pass: service.password,
          client_id: facts.id,
          topic_prefix: facts.id,
          rpc_ntf: true,
          status_ntf: true,
          enable_control: true,
        },
      },
      password
    );
    await shellyRpc(ip, "Shelly.Reboot", {}, password).catch(() => undefined); // it may drop the line while restarting
    const prev = before.enable && before.server && before.server !== server ? before.server : null;
    return { previousServer: prev };
  }
  const before = await shellyGen1Get<{ mqtt?: { enable?: boolean; server?: string } }>(ip, "/settings", password);
  const q = new URLSearchParams({
    mqtt_enable: "true",
    mqtt_server: server,
    mqtt_user: service.username,
    mqtt_pass: service.password,
    mqtt_id: facts.id,
    mqtt_retain: "false",
  });
  await shellyGen1Get(ip, `/settings?${q.toString()}`, password);
  await shellyGen1Get(ip, "/reboot", password).catch(() => undefined);
  const prev = before.mqtt?.enable && before.mqtt.server && before.mqtt.server !== server ? before.mqtt.server : null;
  return { previousServer: prev };
}
