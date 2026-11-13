/**
 * The server's address on the home network, as the devices see it.
 *
 * SERVER_IP in .env is written once at install time; if the router later gives the server another
 * address, that value is stale. The API runs on Docker's internal network and cannot see the home
 * network itself, but the local-name service runs on the host network: it answers with the address
 * of the server's route to the outside world. Asked at start, every few minutes, and before a
 * device is told where to report.
 */
import { askLocalName, LocalNameUnavailable } from "../home-network/local-name.js";

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const EVERY_MS = 5 * 60 * 1000;

/** The name the home network knows this machine by ("nexternel.local"; LOCAL_NAME in .env). */
export function localHostName(): string {
  return `${(process.env.LOCAL_NAME || "nexternel").toLowerCase()}.local`;
}

let detected: string | null = null;
/** The local-name service is still starting — worth asking again. */
let retryable = false;

/** Last detected address, or null when it could not be detected (then .env SERVER_IP is used). */
export function detectedHostIp(): string | null {
  return detected;
}

export async function refreshHostIp(): Promise<string | null> {
  try {
    const { address } = await askLocalName<{ address: string | null }>("/address", 3_000);
    if (address && IPV4.test(address) && !address.startsWith("127.")) detected = address;
    retryable = false;
  } catch (err) {
    // Keep the previous value. Only a starting service is worth waiting for.
    retryable = err instanceof LocalNameUnavailable;
  }
  return detected;
}

let timer: NodeJS.Timeout | null = null;
/** Keep the address current while running (a router may hand out another one). */
export function keepHostIpCurrent(): void {
  if (timer) return;
  timer = setInterval(() => void refreshHostIp(), EVERY_MS);
  timer.unref();
}

/** At startup ESPHome may still be starting: try for up to ~40 s. */
export async function refreshHostIpAtStartup(): Promise<string | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    if ((await refreshHostIp()) || !retryable) return detected;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  return detected;
}
