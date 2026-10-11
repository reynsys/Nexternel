/**
 * The server's address on the home network, as the devices see it.
 *
 * SERVER_IP in .env is written once at install time; if the router later gives the server another
 * address (e.g. the old server's, to take over its devices), that value is stale. The API runs on
 * Docker's internal network and cannot see the home network itself, but the ESPHome container runs
 * on the host network: ask it which address the server uses to reach the outside world.
 */
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ESPHOME_CONTAINER = "nexternel-esphome";
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
// A UDP "connect" sends nothing; it only picks the address of the route to the internet.
const PROBE =
  "import socket; s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(('1.1.1.1', 80)); print(s.getsockname()[0])";

let detected: string | null = null;
/** ESPHome exists but is still starting — worth asking again. */
let retryable = false;

/** Last detected address, or null when it could not be detected (then .env SERVER_IP is used). */
export function detectedHostIp(): string | null {
  return detected;
}

export async function refreshHostIp(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("docker", ["exec", ESPHOME_CONTAINER, "python3", "-c", PROBE], {
      timeout: 15_000,
    });
    const ip = stdout.trim();
    if (IPV4.test(ip) && !ip.startsWith("127.")) detected = ip;
    retryable = false;
  } catch (err) {
    // Keep the previous value. Only a starting container is worth waiting for — not a machine
    // without Docker access (development) or without the ESPHome container.
    const text = String((err as { stderr?: string }).stderr ?? (err as Error).message ?? "");
    retryable = /is not running|is restarting/i.test(text);
  }
  return detected;
}

/** At startup ESPHome may still be starting: try for up to ~40 s. */
export async function refreshHostIpAtStartup(): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    if ((await refreshHostIp()) || !retryable) return detected;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  return detected;
}
