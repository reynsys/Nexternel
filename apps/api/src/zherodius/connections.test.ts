import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { CapabilityRow } from "../capabilities/store.js";
import { createDevicePath, NotConfirmedError } from "../devices/device-path.js";
import { getLiveState } from "../telemetry/state-cache.js";
import { createZherodiusConnections, type ConnectionsDeps, type Pairing } from "./connections.js";
import { planItems, type ItemMap } from "./items.js";
import { hex, x25519Key } from "./line-crypto.js";
import { pairDevice } from "./line.js";
import { PretendDevice } from "./pretend-device.js";

const device = new PretendDevice();
const hub = x25519Key();
let run = 0;

before(async () => {
  await device.start();
  device.pairingCode = "7KQ2M9XD";
  await pairDevice({ address: device.address, code: "7KQ2M9XD", hub, hubName: "Nexternel" });
  device.pairingCode = null;
});
after(() => device.stop());
beforeEach(() => {
  run += 1;
  device.answers = true;
  device.relays.set(1, false);
});

const waitFor = async (check: () => boolean, ms = 3000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};

/** Everything around the connection, recorded; items get ids unique to the test. */
function setup(over: Partial<ConnectionsDeps> = {}) {
  const calls = {
    reports: [] as { itemId: string; value: unknown; kind: string; history: unknown }[],
    online: [] as string[],
    offline: [] as string[],
    activity: [] as string[],
    syncs: 0,
    seen: [] as { address: string; cfg: number | null; version: string }[],
  };
  const pairing: Pairing = {
    deviceId: `dev-${run}`,
    deviceName: device.name,
    deviceSlug: "zherodius-zh-test-0001",
    serial: device.serial,
    address: device.address,
    deviceKey: hex(device.key.pub),
    cfg: null,
  };
  const deps: ConnectionsDeps = {
    hubKey: async () => hub,
    listPairings: async () => [pairing],
    itemsOf: async () => new Map(),
    async syncItems(_id, info) {
      calls.syncs += 1;
      const map: ItemMap = new Map();
      for (const p of planItems(info)) map.set(p.slug, { itemId: `${run}-${p.slug}`, kind: p.kind === "relay" ? "switch" : p.sensorType });
      return map;
    },
    saveSeen: (_id, seen) => calls.seen.push(seen),
    findAddress: async () => null,
    path: {
      reportItem: (itemId, value, o) => calls.reports.push({ itemId, value, kind: o.kind, history: o.history }),
      deviceOnline: (ids) => calls.online.push(...ids),
      deviceOffline: (ids) => calls.offline.push(...ids),
      deviceHeard: () => {},
    },
    logActivity: (e) => calls.activity.push(e.text),
    retryMs: [50],
    ...over,
  };
  const conns = createZherodiusConnections(deps);
  return { conns, calls, pairing };
}

test("a paired device: its items are read, it is online, its readings arrive", async () => {
  const { conns, calls, pairing } = setup();
  await conns.add(pairing);
  assert.equal(calls.syncs, 1);
  assert.deepEqual(calls.online, [pairing.deviceId]);
  assert.ok(conns.isOpen(pairing.deviceId));
  const temp = calls.reports.find((r) => r.itemId === `${run}-sensor_3_t`);
  assert.equal(temp?.value, 21.5);
  assert.deepEqual(temp?.history, { deviceSlug: "zherodius-zh-test-0001", entityId: "sensor_3_t" });
  assert.equal(calls.reports.find((r) => r.itemId === `${run}-relay_1`)?.value, false);
  assert.equal(calls.seen.at(-1)?.version, "1.10.2");
  conns.stop();
});

test("a change on the device shows by itself", async () => {
  const { conns, calls, pairing } = setup();
  await conns.add(pairing);
  device.relays.set(2, true);
  device.notify();
  await waitFor(() => calls.reports.some((r) => r.itemId === `${run}-relay_2` && r.value === true));
  conns.stop();
});

test("renamed or new parts on the device: its items are read again", async () => {
  const { conns, calls, pairing } = setup();
  await conns.add(pairing);
  device.info.parts.push({ id: 4, type: "relay", name: "Fountain" });
  device.relays.set(4, true);
  device.notify();
  await waitFor(() => calls.reports.some((r) => r.itemId === `${run}-relay_4`));
  assert.equal(calls.syncs, 2);
  device.info.parts.pop();
  device.relays.delete(4);
  conns.stop();
});

test("the line ending = offline; it opens again by itself", async () => {
  const { conns, calls, pairing } = setup();
  await conns.add(pairing);
  device.dropAll();
  await waitFor(() => calls.offline.length === 1);
  assert.equal(conns.isOpen(pairing.deviceId), false);
  await waitFor(() => calls.online.length === 2);
  assert.ok(conns.isOpen(pairing.deviceId));
  conns.stop();
});

test("a silent line is taken as gone", async () => {
  const { conns, calls, pairing } = setup({ silentMs: 100 });
  await conns.add(pairing);
  await waitFor(() => calls.offline.length >= 1);
  conns.stop();
});

test("a device that moved is found again by its serial number", async () => {
  const { conns, calls, pairing } = setup({ findAddress: async () => device.address });
  await conns.add({ ...pairing, address: "127.0.0.1:1" });
  assert.ok(conns.isOpen(pairing.deviceId));
  assert.equal(calls.seen.at(-1)?.address, device.address);
  conns.stop();
});

test("a device that cannot be reached: said once in the Activity log, and tried again", async () => {
  const { conns, calls, pairing } = setup();
  await conns.add({ ...pairing, address: "127.0.0.1:1" });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(conns.isOpen(pairing.deviceId), false);
  assert.deepEqual(calls.activity, ["Pretend Relays: No answer from 127.0.0.1:1."]);
  conns.stop();
});

test("a removed device's line ends and is not opened again", async () => {
  const { conns, calls, pairing } = setup();
  await conns.add(pairing);
  conns.forget(pairing.deviceId);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(device.openLines, 0);
  assert.equal(calls.online.length, 1);
  conns.stop();
});

/** The connection with the real shared device path: a press as a person makes it. */
function pressSetup() {
  const holder: { conns?: ReturnType<typeof createZherodiusConnections> } = {};
  const activity: string[] = [];
  const path = createDevicePath({
    getItem: async (id) =>
      ({ id, device_id: `dev-${run}`, device_name: device.name, name: "Pump", kind: "switch", source_type: "relay", command_topic: null, firmware_type: "zherodius", connection: "zherodius" }) as CapabilityRow,
    sender: async () => holder.conns!.sender,
    touchDeviceOfItem: () => {},
    setDevicesOnline: () => {},
    itemsToStaleOnOffline: async () => [],
    itemsExemptFromFreshness: async () => new Set(),
    saveSwitchPosition: () => {},
    writeHistory: () => {},
    logSwitchChange: () => {},
    logSensorAnswer: () => {},
    noteSwitchCommand: () => {},
    logActivity: (e) => activity.push(e.text),
    now: () => Date.now(),
  });
  const { conns, pairing } = setup({ path });
  holder.conns = conns;
  return { conns, pairing, path, activity, pump: `${run}-relay_1` };
}

test("a press goes over the line and the device's answer confirms it", async () => {
  const { conns, pairing, path, pump } = pressSetup();
  await conns.add(pairing);
  const started = Date.now();
  assert.deepEqual(await path.switchItem(pump, "on", "rey"), { value: true });
  assert.ok(Date.now() - started < 1000, "answered at once");
  assert.equal(device.relays.get(1), true);
  assert.equal(getLiveState(pump)?.value, true);
  assert.deepEqual(await path.switchItem(pump, "toggle"), { value: false });
  assert.equal(device.relays.get(1), false);
  conns.stop();
});

test("a press while the device is not connected is refused with its name", async () => {
  const { conns, pairing, path, pump } = pressSetup();
  await conns.add(pairing);
  conns.stop();
  await assert.rejects(path.switchItem(pump, "on"), /Nexternel has no line to this device/);
});

test("a press the device does not answer is cancelled, as for every device", async () => {
  const { conns, pairing, path, pump, activity } = pressSetup();
  await conns.add(pairing);
  device.answers = false;
  await assert.rejects(path.switchItem(pump, "on", "rey"), (e: unknown) => e instanceof NotConfirmedError);
  assert.match(activity.at(-1)!, /on press got no answer, so it was cancelled/);
  conns.stop();
});
