import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { UpdateItem, UpdateStep } from "../devices/board-updates.js";
import { createZherodiusConnections, type Pairing } from "./connections.js";
import { hex, x25519Key } from "./line-crypto.js";
import { compareVersions, pairDevice } from "./line.js";
import { PretendDevice } from "./pretend-device.js";
import { createZherodiusUpdater, zherodiusBoardStatus } from "./updates.js";

const device = new PretendDevice();
const hub = x25519Key();
let run = 0;

before(async () => {
  await device.start();
  device.pairingCode = "7KQ2M9XD";
  await pairDevice({ address: device.address, linePort: device.linePort, code: "7KQ2M9XD", hub, hubName: "Nexternel" });
  device.pairingCode = null;
});
after(() => device.stop());

const waitFor = async (check: () => boolean, ms = 3000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};

/** The pretend device on `version`, with `available` on the update server; a connection to it. */
async function setup(version: string, available: string) {
  run += 1;
  device.version = version;
  device.info = { ...device.info, version };
  device.knowsUpdates = compareVersions(version, "1.12.1") >= 0;
  device.available = available;
  device.availableNotes = "Pages open faster.";
  device.newVersionFails = false;
  device.update = { latest: "", notes: "", state: "idle", progress: 0, message: "", trying: false };
  const told: { latest: string; notes: string }[] = [];
  const pairing: Pairing = {
    deviceId: `dev-${run}`,
    deviceName: "Garden Relays",
    deviceSlug: "zherodius-zh-test-0001",
    serial: device.serial,
    address: device.address,
    deviceKey: hex(device.key.pub),
    cfg: null,
    hubName: "Nexternel",
  };
  const conns = createZherodiusConnections({
    hubKey: async () => hub,
    listPairings: async () => [pairing],
    itemsOf: async () => new Map(),
    syncItems: async () => new Map(),
    saveSeen: () => {},
    hubName: async () => "Nexternel",
    saveHubName: () => {},
    findAddress: async () => null,
    path: { reportItem: () => {}, deviceOnline: () => {}, deviceOffline: () => {}, deviceHeard: () => {} },
    logActivity: () => {},
    updateReady: (u) => told.push({ latest: u.latest, notes: u.notes }),
    retryMs: [20],
    linePort: device.linePort,
  });
  await conns.add(pairing);
  const update = createZherodiusUpdater({ conn: conns, pollMs: 10, checkMs: 2000, installMs: 2000, backMs: 2000, keptMs: 2000 });
  const item: UpdateItem = { deviceId: pairing.deviceId, name: "Garden Relays", kind: "zherodius", step: "waiting", message: "", startedAt: null, finishedAt: null, logId: null };
  const steps: { step: UpdateStep; message: string }[] = [];
  const go = () => update(item, { step: (s, m) => steps.push({ step: s, message: m }), log: [] });
  return { conns, pairing, told, go, steps };
}

test("an update from Nexternel: the device checks, installs, restarts and comes back on the new version", async () => {
  const { conns, pairing, go, steps } = await setup("1.12.1", "1.12.2");
  const result = await go();
  assert.deepEqual(result, { step: "done", message: "Updated — Garden Relays is back and runs Zherodius 1.12.2." });
  assert.equal(conns.hello(pairing.deviceId)?.version, "1.12.2");
  assert.deepEqual([...new Set(steps.map((s) => s.step))], ["preparing", "sending", "restarting"]);
  assert.ok(steps.some((s) => /50% downloaded and checked/.test(s.message)));
  conns.stop();
});

test("a new version that does not start properly: the device went back by itself, and the owner is told", async () => {
  const { conns, go } = await setup("1.12.1", "1.12.2");
  device.newVersionFails = true;
  const result = await go();
  assert.equal(result.step, "failed");
  assert.equal(result.message, "Zherodius 1.12.2 did not start properly, so Garden Relays went back to 1.12.1 by itself. Nothing was lost; it can be tried again later.");
  conns.stop();
});

test("nothing newer: already up to date, nothing installed", async () => {
  const { conns, go } = await setup("1.12.1", "");
  assert.deepEqual(await go(), { step: "done", message: "Already up to date — it runs Zherodius 1.12.1, the newest version." });
  assert.equal(device.version, "1.12.1");
  assert.equal(device.update.state, "idle");
  conns.stop();
});

test("a device too old to be updated from Nexternel: it says where to update it instead", async () => {
  const { conns, go } = await setup("1.11.9", "1.12.2");
  const result = await go();
  assert.equal(result.step, "failed");
  assert.match(result.message, /runs Zherodius 1\.11\.9, which can't be updated from Nexternel yet\. Update it once on its own page \(Firmware\)/);
  conns.stop();
});

test("the version the device found is noted with its notes, and told once", async () => {
  const { conns, pairing, told } = await setup("1.12.1", "1.12.2");
  await conns.askUpdate(pairing.deviceId, "check");
  await waitFor(() => conns.updateOf(pairing.deviceId)?.latest === "1.12.2");
  assert.deepEqual(conns.updateOf(pairing.deviceId), { latest: "1.12.2", notes: "Pages open faster." });
  device.notify();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(told, [{ latest: "1.12.2", notes: "Pages open faster." }]);
  conns.stop();
});

test("the Devices list: an update waiting, up to date, or too old to update from Nexternel", () => {
  const base = { deviceId: "d1", name: "Garden Relays", connected: true, recentDrops: 0 };
  const waiting = zherodiusBoardStatus({ ...base, version: "1.12.1", update: { latest: "1.12.2", notes: "Pages open faster." } });
  assert.equal(waiting.updateState, "update");
  assert.equal(waiting.updateReason, "Zherodius 1.12.2 is ready (it runs 1.12.1): Pages open faster");
  assert.equal(zherodiusBoardStatus({ ...base, version: "1.12.2", update: { latest: "1.12.2", notes: "" } }).updateState, "current");
  assert.equal(zherodiusBoardStatus({ ...base, version: "1.11.9", update: null }).updateState, "own-page");
  assert.equal(compareVersions("1.11.10", "1.11.9"), 1);
});
