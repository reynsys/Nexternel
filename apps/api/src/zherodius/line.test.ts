import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { hex, x25519Key } from "./line-crypto.js";
import { openLine, pairDevice, type DeviceInfo, type DeviceStatus } from "./line.js";
import { PretendDevice } from "./pretend-device.js";

const device = new PretendDevice();
const hub = x25519Key();
before(() => device.start());
after(() => device.stop());

const waitFor = async (check: () => boolean, ms = 2000) => {
  const until = Date.now() + ms;
  while (!check()) {
    if (Date.now() > until) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};

test("pairing is refused while it is not open on the device", async () => {
  device.pairingCode = null;
  await assert.rejects(pairDevice({ address: device.address, linePort: device.linePort, code: "7KQ2-M9XD", hub, hubName: "Nexternel" }), /Pairing is not open on Pretend Relays/);
});

test("a wrong pairing code is refused, and the hub is not paired", async () => {
  device.pairingCode = "7KQ2M9XD";
  await assert.rejects(pairDevice({ address: device.address, linePort: device.linePort, code: "7KQ2-M9XE", hub, hubName: "Nexternel" }), /pairing code is not right/);
  assert.equal(device.pairedHubs.size, 0);
});

test("a code of the wrong length is refused before asking the device", async () => {
  await assert.rejects(pairDevice({ address: device.address, linePort: device.linePort, code: "7KQ2", hub, hubName: "Nexternel" }), /8 letters and numbers/);
});

test("pairing with the right code (typed in small letters, with a dash) keeps both keys", async () => {
  device.pairingCode = "7KQ2M9XD";
  const hello = await pairDevice({ address: device.address, linePort: device.linePort, code: "7kq2-m9xd", hub, hubName: "Nexternel" });
  assert.equal(hello.key, hex(device.key.pub));
  assert.equal(device.pairedHubs.get(hex(hub.pub)), "Nexternel");
  device.pairingCode = null;
});

test("the open line asks, switches and hears changes", async () => {
  const heard: DeviceStatus[] = [];
  let closed = false;
  const line = await openLine({
    address: device.address, linePort: device.linePort,
    hub,
    deviceKey: hex(device.key.pub),
    serial: device.serial,
    onStatus: (s) => heard.push(s),
    onClose: () => (closed = true),
  });
  const info = await line.call<DeviceInfo>("Zh.GetInfo");
  assert.equal(info.parts.length, 3);
  assert.deepEqual(await line.call("Relay.Set", { id: 1, on: true }), { on: true });
  await waitFor(() => heard.length === 1);
  assert.equal(heard[0]!.relays![0]!.on, true);
  await assert.rejects(line.call("Relay.Set", { id: 9, on: true }), /no relay with that number/);
  device.dropAll();
  await waitFor(() => closed);
  await assert.rejects(line.call("Zh.GetStatus"), /closed/);
});

test("a hub the device does not know is told so", async () => {
  await assert.rejects(
    openLine({ address: device.address, linePort: device.linePort, hub: x25519Key(), deviceKey: hex(device.key.pub), serial: device.serial, onStatus: () => {}, onClose: () => {} }),
    /not paired with this device/
  );
});

test("a device answering with another key is not trusted", async () => {
  await assert.rejects(
    openLine({ address: device.address, linePort: device.linePort, hub, deviceKey: hex(x25519Key().pub), serial: device.serial, onStatus: () => {}, onClose: () => {} }),
    /not the one kept when it was paired/
  );
});

test("another device at the kept address is noticed", async () => {
  await assert.rejects(
    openLine({ address: device.address, linePort: device.linePort, hub, deviceKey: hex(device.key.pub), serial: "ZH-OTHER", onStatus: () => {}, onClose: () => {} }),
    /Another device/
  );
});

test("the line goes over the device's own port, not over its web page", async () => {
  assert.ok(device.viaPort > 0);
  assert.equal(device.viaWebSocket, 0);
});

test("an older device without its own line port (before Zherodius 1.13.1) is reached over its web page", async () => {
  const old = new PretendDevice();
  old.ownLinePort = false;
  old.version = "1.12.1";
  await old.start();
  try {
    old.pairingCode = "7KQ2M9XD";
    await pairDevice({ address: old.address, linePort: old.linePort, code: "7KQ2M9XD", hub, hubName: "Nexternel" });
    old.pairingCode = null;
    const line = await openLine({ address: old.address, linePort: old.linePort, hub, deviceKey: hex(old.key.pub), serial: old.serial, onStatus: () => {}, onClose: () => {} });
    assert.deepEqual(await line.call("Relay.Set", { id: 2, on: true }), { on: true });
    line.close();
    assert.equal(old.viaPort, 0);
    assert.equal(old.viaWebSocket, 2);
  } finally {
    await old.stop();
  }
});

test("a long message arrives whole over the line port", async () => {
  const before = device.info.parts;
  device.info = { ...device.info, parts: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, type: "relay", name: `Relay number ${i + 1} in the garden shed` })) };
  try {
    const line = await openLine({ address: device.address, linePort: device.linePort, hub, deviceKey: hex(device.key.pub), serial: device.serial, onStatus: () => {}, onClose: () => {} });
    const info = await line.call<DeviceInfo>("Zh.GetInfo");
    assert.equal(info.parts.length, 40);
    line.close();
  } finally {
    device.info = { ...device.info, parts: before };
  }
});

test("no device at the address", async () => {
  await assert.rejects(pairDevice({ address: "127.0.0.1:1", linePort: 1, code: "7KQ2M9XD", hub, hubName: "Nexternel" }), /No answer from 127.0.0.1:1/);
});
