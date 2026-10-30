import { execFile } from "child_process";
import { promisify } from "util";

/**
 * Which ESPHome settings file belongs to which board — by identity, never by a similar name.
 * A board's identity is its message address (MQTT topic prefix): where it reports, unique per board.
 * ESPHome itself reads each file (substitutions and included files resolved) and says which address
 * it uses; a device's file is the one whose address is exactly the device's.
 */

const execFileAsync = promisify(execFile);
const ESPHOME_CONTAINER = process.env.ESPHOME_CONTAINER_NAME || "nexternel-esphome";

/** GET from ESPHome's page through its private socket (JSON). */
export async function esphomeGet<T>(path: string, timeoutSec = 10): Promise<T | null> {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", ESPHOME_CONTAINER, "curl", "-s", "--fail", "--max-time", String(timeoutSec), "--unix-socket", "/run/esphome/dashboard.sock", `http://localhost${path}`],
      { timeout: (timeoutSec + 10) * 1000, maxBuffer: 16 * 1024 * 1024 }
    );
    return JSON.parse(stdout) as T;
  } catch {
    return null;
  }
}

/** The settings files ESPHome has (e.g. "garden-relays.yaml"). */
export async function esphomeFiles(): Promise<string[]> {
  const r = await esphomeGet<{ configured?: { configuration: string }[] }>("/devices");
  return (r?.configured ?? []).map((c) => c.configuration);
}

/** File → the message address it gives its board (null: the file has none or could not be read). */
const addresses = new Map<string, string | null>();

export async function fileAddress(file: string): Promise<string | null> {
  if (addresses.has(file)) return addresses.get(file)!;
  const c = await esphomeGet<{ mqtt?: { topic_prefix?: string } }>(`/json-config?configuration=${encodeURIComponent(file)}`, 90);
  const address = c?.mqtt?.topic_prefix?.trim() || null;
  // A file ESPHome could not read is asked again next time (it may be fixed meanwhile).
  if (c) addresses.set(file, address);
  return address;
}

/** Forget what a file said (after it was saved or replaced). */
export function forgetFileAddress(file?: string): void {
  if (file) addresses.delete(file);
  else addresses.clear();
}

/** The files whose message address is exactly `address`. */
export async function filesForAddress(address: string): Promise<string[]> {
  const out: string[] = [];
  for (const file of await esphomeFiles()) if ((await fileAddress(file)) === address) out.push(file);
  return out;
}
