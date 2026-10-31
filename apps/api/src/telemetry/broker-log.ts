import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getPool } from "../db.js";
import { logActivity } from "../activity/activity.js";
import { boardAtAddress } from "../devices/board-health.js";
import { mosquittoConfigDir } from "../backup/paths.js";

const execFileAsync = promisify(execFile);

/**
 * Why the message service (Mosquitto) dropped a board, in its own words. Mosquitto writes a notice
 * for every connection that ends — the board stopped answering, the network broke, the board went
 * away without saying goodbye — and, with `log_dest topic`, publishes those notices on
 * $SYS/broker/log/<level>. Nexternel reads them and writes the ones that matter into the Activity
 * log. Only notices, warnings and errors: a few short lines per drop, nothing in between.
 */

export const BROKER_LOG_TOPIC = "$SYS/broker/log/#";
const LOG_LINE = "log_dest topic";

/** Turns the notices on in mosquitto.conf (once) and has Mosquitto re-read its settings. */
export async function ensureBrokerLogTopic(): Promise<void> {
  const file = path.join(mosquittoConfigDir(), "mosquitto.conf");
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  if (text.split("\n").some((l) => l.trim() === LOG_LINE)) return;
  const block = `\n# Nexternel reads the message service's notices (why a device was disconnected) from $SYS/broker/log.\n${LOG_LINE}\n`;
  fs.writeFileSync(file, text.replace(/\s*$/, "\n") + block);
  // Mosquitto re-reads its log settings on a reload signal: no restart, no device is disconnected.
  await execFileAsync("docker", ["kill", "-s", "HUP", "nexternel-mosquitto"], { timeout: 15_000 }).catch(() => undefined);
}

/** A client's address, from its "New client connected" notice (client id → address). */
const addressOf = new Map<string, string>();
/** The same notice for the same client is written once a minute at most. */
const lastWritten = new Map<string, number>();

const CONNECTED = /^New client connected from (\S+?):\d+ as (\S+) /;

/** Mosquitto 2.1: "Client <id> [<address>:<port>] disconnected: <reason>." */
const ENDED_21 = /^Client (\S+) \[([^\]]+?):\d+\] disconnected(?::\s*(.+?))?\.?$/;
const REASON_WORDS: { re: RegExp; words: string }[] = [
  {
    re: /exceeded timeout/i,
    words: "stopped answering, so the message service closed its connection (nothing was heard from it within its keep-alive time)",
  },
  { re: /closed by client/i, words: "dropped its connection to the message service without saying goodbye (a Wi‑Fi hiccup, or it restarted its connection)" },
  { re: /session taken over|already connected/i, words: "connected again while its old connection was still open, so the old one was closed. If this repeats every few seconds, two devices use the same name" },
  { re: /not authori[sz]ed|bad user|password/i, words: "was refused by the message service: wrong user name or password" },
  { re: /socket error|protocol error|connection reset|broken pipe/i, words: "lost its connection to the message service (a network error)" },
];

/** Mosquitto 2.0 wordings. */
const ENDED: { re: RegExp; words: string }[] = [
  {
    re: /^Client (\S+) has exceeded timeout, disconnecting/,
    words: "stopped answering, so the message service closed its connection (nothing was heard from it within its keep-alive time)",
  },
  { re: /^Socket error on client (\S+), disconnecting/, words: "lost its connection to the message service (a network error)" },
  {
    re: /^Client (\S+) closed its connection/,
    words: "dropped its connection to the message service without saying goodbye (a Wi‑Fi hiccup, or it restarted its connection)",
  },
  {
    re: /^Client (\S+) already connected, closing old connection/,
    words: "connected again while its old connection was still open, so the old one was closed. If this repeats every few seconds, two devices use the same name",
  },
  { re: /^Client (\S+) disconnected, not authori[sz]ed/, words: "was refused by the message service: wrong user name or password" },
];

/** One notice from $SYS/broker/log/<level>: a dropped connection goes into the Activity log. */
export function applyBrokerLog(payload: string): void {
  // "1730390000: New client connected from …" — the time in front is Mosquitto's own.
  const line = payload.replace(/^\d+:\s*/, "").trim();
  const c = CONNECTED.exec(line);
  if (c) {
    addressOf.set(c[2]!, c[1]!);
    return;
  }
  const m21 = ENDED_21.exec(line);
  if (m21) {
    // No reason: the client said goodbye (a restart or an update) — not a drop.
    if (!m21[3]) return;
    const words = REASON_WORDS.find((r) => r.re.test(m21[3]!))?.words ?? `was disconnected by the message service (${m21[3]})`;
    notice(m21[1]!, m21[2]!, words);
    return;
  }
  for (const { re, words } of ENDED) {
    const m = re.exec(line);
    if (!m) continue;
    notice(m[1]!, addressOf.get(m[1]!) ?? null, words);
    return;
  }
}

function notice(clientId: string, address: string | null, words: string) {
  // Nexternel's own connection is already in the log ("Connection to the message service …").
  if (clientId.startsWith("nexternel-api-")) return;
  const key = `${clientId} ${words}`;
  const now = Date.now();
  if (now - (lastWritten.get(key) ?? 0) < 60_000) return;
  lastWritten.set(key, now);
  void writeNotice(clientId, address, words).catch(() => undefined);
}

async function writeNotice(clientId: string, address: string | null, words: string): Promise<void> {
  // The board is known by its address, from its health report (boards that send one).
  const prefix = address ? boardAtAddress(address) : null;
  const d = prefix ? await getPool().query<{ id: string; name: string }>(`SELECT id, name FROM devices WHERE mqtt_topic_prefix = $1`, [prefix]) : null;
  const row = d?.rows[0];
  if (row) {
    await logActivity({ kind: "device", deviceId: row.id, text: `${row.name} ${words}` });
    return;
  }
  const who = `A device${address ? ` at ${address}` : ""} (it calls itself "${clientId}")`;
  await logActivity({ kind: "system", text: `${who} ${words}` });
}
