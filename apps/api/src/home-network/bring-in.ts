/**
 * Search my home → Bring in: take a found device into Nexternel.
 * Shelly switches: point them at Nexternel's message service (their own web address, no cloud).
 * ESPHome boards: Nexternel makes its own board software for the board and installs it over Wi-Fi.
 */
import { ESPHOME_BOARD_CATALOG, ESPHOME_BUILDER_CONFIG_VERSION, type FoundDevice } from "@nexternel/domain";
import { createManagedEsphomeDevice } from "../esphome/builder/registry.js";
import { compileEsphomeDevice, uploadEsphomeDevice } from "../esphome/builder/firmware.js";
import { checkEsphomeBuildPrerequisites } from "../esphome/secrets.js";
import { deleteDevice } from "../devices/service.js";
import { config } from "../config.js";
import { refreshHostIp } from "../system/host-ip.js";
import { createDevice } from "../devices/service.js";
import { getPool } from "../db.js";
import { afterDeviceMutation } from "../routes/devices.js";
import { shellyPresetIdForSwitchCount } from "../shelly/models.js";
import { normaliseMac } from "./classify.js";
import { pointShellyAtNexternel, readShelly } from "./shelly-local.js";

export type BringInResult = { deviceId: string; name: string; message: string };

export class BringInRefused extends Error {
  constructor(message: string, readonly code = "bring_in_refused") {
    super(message);
  }
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

async function existingByMac(mac: string | null): Promise<{ id: string; name: string } | null> {
  const want = normaliseMac(mac);
  if (!want) return null;
  const rows = await getPool().query<{ id: string; name: string; mac_address: string | null }>(
    `SELECT id, name, mac_address FROM devices WHERE mac_address IS NOT NULL`
  );
  const hit = rows.rows.find((r) => normaliseMac(r.mac_address) === want);
  return hit ? { id: hit.id, name: hit.name } : null;
}

async function bringInShelly(found: FoundDevice, password?: string): Promise<BringInResult> {
  const ip = found.address;
  if (!ip || !IPV4.test(ip)) throw new BringInRefused("Nexternel doesn't know this switch's address. Search again.");
  await refreshHostIp(); // the address the switch must use, as it is right now
  const host = config.serverIp();
  if (!host) throw new BringInRefused("Nexternel doesn't know its own address on your home network yet. Restart Nexternel and try again.");

  const facts = await readShelly(ip, password);
  if (!facts.id) throw new BringInRefused("The switch didn't say its name. Restart it and try again.");
  const already = await existingByMac(facts.mac);
  if (already) throw new BringInRefused(`This switch is already in Nexternel as “${already.name}”.`);

  const { previousServer } = await pointShellyAtNexternel(
    ip,
    facts,
    { host, port: 1883, username: config.mqttUsername(), password: config.mqttPassword() },
    password
  );

  const name = facts.name || found.name;
  const device = await createDevice({
    name,
    mqttTopicPrefix: facts.id,
    firmwareType: "shelly",
    shellyGen: facts.gen,
    shellySwitchCount: facts.switchCount,
    shellyModelId: shellyPresetIdForSwitchCount(facts.switchCount),
    ipAddress: ip,
    macAddress: normaliseMac(facts.mac),
  });
  await afterDeviceMutation();

  const parts = [`Brought in as “${device.name}”. It restarts and shows up in a few seconds.`];
  if (previousServer) parts.push(`It used to report to another message service (${previousServer}); it reports to Nexternel now.`);
  if (facts.gen === 1) parts.push("Original (Gen 1) Shelly switches stop using Shelly's online service when they report to Nexternel.");
  return { deviceId: device.id, name: device.name, message: parts.join(" ") };
}

/** The board kind Nexternel knows for what the board says it is ("esp32dev", "nodemcuv2", …). */
export function boardIdFor(board: string | null | undefined) {
  const want = (board || "").trim().toLowerCase();
  return ESPHOME_BOARD_CATALOG.find((b) => b.esphomeBoard.toLowerCase() === want || b.id.toLowerCase() === want) ?? null;
}

/** ESPHome says this when the board checks an update password Nexternel doesn't have. */
export function isUpdatePasswordRefusal(log: string): boolean {
  return /auth(entication)? (failed|invalid|error)|password|ERROR_AUTH/i.test(log);
}

async function bringInBoard(found: FoundDevice): Promise<BringInResult> {
  const ip = found.address;
  if (!ip || !IPV4.test(ip)) throw new BringInRefused("Nexternel doesn't know this board's address. Search again.");
  const board = boardIdFor(found.board);
  if (!board) {
    throw new BringInRefused(
      "Nexternel doesn't know this kind of board yet, so it can't make its software. Add it yourself with Add device → ESPHome board."
    );
  }
  const wifi = checkEsphomeBuildPrerequisites();
  if (!wifi.wifiConfigured) {
    throw new BringInRefused("Nexternel needs your Wi-Fi name and password for boards first.", "devices_wifi_needed");
  }
  const already = await existingByMac(found.mac);
  if (already) throw new BringInRefused(`This board is already in Nexternel as “${already.name}”.`);

  const created = await createManagedEsphomeDevice({
    config: {
      version: ESPHOME_BUILDER_CONFIG_VERSION,
      platform: board.platform,
      boardId: board.id,
      displayName: found.name,
      components: [],
    },
  });
  const deviceId = created.deviceId;
  await getPool().query(`UPDATE devices SET ip_address = $2, mac_address = $3 WHERE id = $1`, [
    deviceId,
    ip,
    normaliseMac(found.mac),
  ]);

  const built = await compileEsphomeDevice(deviceId);
  if (!built.ok) {
    throw new BringInRefused(
      `Nexternel couldn't make the board's software. “${found.name}” is in Devices: open it and press Install to try again.`
    );
  }
  const sent = await uploadEsphomeDevice(deviceId, ip);
  if (!sent.ok) {
    if (isUpdatePasswordRefusal(sent.log)) {
      // Nothing was changed on the board: leave Nexternel as it was.
      await deleteDevice(deviceId, { deleteYaml: true }).catch(() => undefined);
      throw new BringInRefused(
        "This board has an update password from the system that set it up, so it refused Nexternel's software. Nothing was changed on it."
      );
    }
    throw new BringInRefused(
      `The board didn't take the new software. “${found.name}” is in Devices: check it has power, then open it and press Install.`
    );
  }
  await afterDeviceMutation();
  return {
    deviceId,
    name: found.name,
    message: `Brought in as “${found.name}”. It restarts with Nexternel's software. Add its readings and switches from Devices → ${found.name}.`,
  };
}

export async function bringInFoundDevice(found: FoundDevice, opts: { password?: string } = {}): Promise<BringInResult> {
  if (found.alreadyIn) throw new BringInRefused(`This is already in Nexternel as “${found.alreadyIn.name}”.`);
  switch (found.kind) {
    case "shelly":
      return bringInShelly(found, opts.password);
    case "board":
      return bringInBoard(found);
    default:
      throw new BringInRefused("Nexternel can't bring this kind of device in yet.");
  }
}
