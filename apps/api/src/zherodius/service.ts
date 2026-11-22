/**
 * The Zherodius connection as it runs in this server: the lines (connections.ts) wired to the
 * database (store.ts), the shared device path and the Activity log.
 */
import { logActivity } from "../activity/activity.js";
import { config } from "../config.js";
import { getPool } from "../db.js";
import { readAnywhereSettings } from "../system/anywhere.js";
import { devicePath } from "../devices/device-path-store.js";
import { createZherodiusConnections } from "./connections.js";
import { LineError, pairDevice } from "./line.js";
import { findAddress, getPairing, hubKey, itemsOf, listPairings, savePairedDevice, saveHubName, saveSeen, syncItems } from "./store.js";

export const zherodius = createZherodiusConnections({
  hubKey,
  listPairings,
  itemsOf,
  syncItems,
  saveSeen,
  hubName: () => hubName(),
  saveHubName,
  findAddress,
  path: devicePath,
  logActivity: (e) => void logActivity({ kind: "device", deviceId: e.deviceId, text: e.text }),
});

/** The device keeps at most this many bytes of a hub's name. */
const HUB_NAME_BYTES = 32;

/** Cut a name to fit the device, never in the middle of a letter. */
export function fitHubName(name: string): string {
  let out = "";
  for (const ch of name.trim()) {
    if (Buffer.byteLength(out + ch, "utf8") > HUB_NAME_BYTES) break;
    out += ch;
  }
  return out.trim();
}

/**
 * How Nexternel names itself to the device (its page lists each paired Nexternel by this name):
 * the home's name, or else the computer it runs on, so two Nexternels can be told apart.
 */
async function hubName(): Promise<string> {
  const anywhere = await readAnywhereSettings().catch(() => null);
  const home = anywhere?.name && anywhere.key ? anywhere.name : "";
  const ip = config.serverIp();
  return fitHubName(home || (ip ? `Nexternel at ${ip}` : "Nexternel"));
}

/** An address as typed: a name or IPv4 address, optionally with a port; nothing else. */
const ADDRESS = /^[A-Za-z0-9.-]{1,253}(:\d{1,5})?$/;

export class PairingRefusedError extends Error {}

/**
 * Pair a Zherodius device: the owner opened pairing on the device's page and typed the code shown there.
 * The device becomes a Nexternel device in the chosen area, and its line opens.
 */
export async function pairZherodius(o: {
  address: string;
  code: string;
  roomId: string | null;
}): Promise<{ deviceId: string; name: string; online: boolean; switches: number; readings: number }> {
  const address = o.address.trim();
  if (!ADDRESS.test(address)) throw new PairingRefusedError("Type the device's address as shown on its page, for example 192.168.1.40.");
  const name = await hubName();
  let hello;
  try {
    hello = await pairDevice({ address, code: o.code, hub: await hubKey(), hubName: name });
  } catch (err) {
    if (err instanceof LineError) throw new PairingRefusedError(err.message);
    throw err;
  }
  const deviceId = await savePairedDevice({ hello, address, roomId: o.roomId, hubName: name });
  void logActivity({ kind: "device", deviceId, text: `${hello.name} was paired with Nexternel (Zherodius ${hello.version})` });
  const pairing = await getPairing(deviceId);
  if (pairing) await zherodius.add(pairing);
  const counts = await getPool().query<{ switches: string; readings: string }>(
    `SELECT (SELECT COUNT(*) FROM relays WHERE device_id = $1) AS switches, (SELECT COUNT(*) FROM sensors WHERE device_id = $1) AS readings`,
    [deviceId]
  );
  return {
    deviceId,
    name: hello.name,
    online: zherodius.isOpen(deviceId),
    switches: Number(counts.rows[0]?.switches ?? 0),
    readings: Number(counts.rows[0]?.readings ?? 0),
  };
}

/**
 * The owner removes a Zherodius device: it is asked to forget this Nexternel too, so it frees one of its
 * 3 places. When it cannot be asked, the Activity log says where the owner can do it on the device.
 */
export async function unpairZherodius(deviceId: string): Promise<void> {
  const pairing = await getPairing(deviceId).catch(() => null);
  const name = pairing?.deviceName ?? "The device";
  const result = await zherodius.unpair(deviceId);
  const text =
    result === "done"
      ? `${name} was removed and no longer lists this Nexternel`
      : result === "old"
        ? `${name} was removed. Its firmware is too old to be told, so it still lists this Nexternel: on the device's page, open Settings, Nexternel and press Unpair (or update it to Zherodius 1.11.9 or newer first)`
        : result === "unreachable"
          ? `${name} was removed, but it did not answer, so it still lists this Nexternel: on the device's page, open Settings, Nexternel and press Unpair`
          : null;
  if (text) await logActivity({ kind: "device", deviceId, text }).catch(() => undefined);
}
