import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import type { CapabilityRow } from "../capabilities/store.js";
import { getLiveState, setLiveState } from "../telemetry/state-cache.js";
import type { ControlState } from "./controls.js";
import {
  canCommand,
  connectionOf,
  ControlRefusedError,
  createDevicePath,
  INTERNET_ANSWER_MS,
  NotConfirmedError,
  SWITCH_ANSWER_MS,
  type ControlInfo,
  type DevicePathDeps,
  type ItemSender,
} from "./device-path.js";

let n = 0;
/** A fresh item id per test: the live values are shared by the whole process. */
const newId = () => `item-${++n}-${Math.random().toString(36).slice(2)}`;
const flush = () => new Promise((r) => setImmediate(r));

function makeItem(id: string, over: Partial<CapabilityRow> = {}): CapabilityRow {
  return {
    id,
    device_id: "dev-1",
    device_name: "Garden Relays",
    name: "Pump",
    kind: "switch",
    source_type: "relay",
    command_topic: "nexternel/garden/switch/pump/command",
    firmware_type: "esphome",
    connection: "mqtt",
    ...over,
  } as CapabilityRow;
}

function setup(
  opts: { unavailable?: string | null; sendFails?: boolean; items?: CapabilityRow[]; controls?: Record<string, ControlInfo> } = {}
) {
  const calls = {
    sent: [] as { id: string; on: boolean }[],
    changes: [] as { id: string; change: ControlState }[],
    notes: [] as { id: string; on: boolean; who: string }[],
    activity: [] as string[],
    switchChanges: [] as { id: string; on: boolean }[],
    sensorAnswers: [] as { id: string; answering: boolean }[],
    history: [] as { deviceSlug: string; entityId: string; value: number }[],
    positions: [] as { id: string; on: boolean }[],
    touchedItems: [] as string[],
    online: [] as { ids: string[]; online: boolean }[],
  };
  const items = new Map((opts.items ?? []).map((i) => [i.id, i]));
  const sender: ItemSender = {
    unavailable: () => opts.unavailable ?? null,
    async send(item, on) {
      if (opts.sendFails) throw new Error("send failed");
      calls.sent.push({ id: item.id, on });
    },
    async sendControl(item, change) {
      if (opts.sendFails) throw new Error("send failed");
      calls.changes.push({ id: item.id, change });
    },
  };
  const deps: DevicePathDeps = {
    getItem: async (id) => items.get(id) ?? null,
    sender: async () => sender,
    getControl: async (id) => opts.controls?.[id] ?? null,
    touchDeviceOfItem: (id) => calls.touchedItems.push(id),
    setDevicesOnline: (ids, online) => calls.online.push({ ids, online }),
    itemsToStaleOnOffline: async () => [...items.keys()],
    itemsExemptFromFreshness: async () => new Set(),
    saveSwitchPosition: (id, on) => calls.positions.push({ id, on }),
    writeHistory: (key, value) => calls.history.push({ ...key, value }),
    logSwitchChange: (id, on) => calls.switchChanges.push({ id, on }),
    logSensorAnswer: (id, answering) => calls.sensorAnswers.push({ id, answering }),
    noteSwitchCommand: (id, on, who) => calls.notes.push({ id, on, who }),
    logActivity: (e) => calls.activity.push(e.text),
    now: () => Date.now(),
  };
  return { path: createDevicePath(deps), calls };
}

beforeEach(() => mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 1_800_000_000_000 }));
afterEach(() => mock.timers.reset());

test("a press counts once the board reports the new position", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id)] });
  const press = path.switchItem(id, "on", "rey");
  await flush();
  assert.deepEqual(calls.sent, [{ id, on: true }]);
  assert.deepEqual(calls.notes, [{ id, on: true, who: "rey" }]);
  path.reportItem(id, true, { kind: "switch", retained: false });
  assert.deepEqual(await press, { value: true });
  assert.deepEqual(calls.positions, [{ id, on: true }]);
});

test("a press without an answer is cancelled, and a late 'on' is switched off again", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id)] });
  setLiveState(id, false);
  const press = path.switchItem(id, "on", "rey");
  await flush();
  mock.timers.tick(SWITCH_ANSWER_MS);
  await assert.rejects(press, (err: unknown) => err instanceof NotConfirmedError && /so this press was cancelled/.test(err.message));
  assert.match(calls.activity[0]!, /on press got no answer, so it was cancelled/);

  path.reportItem(id, true, { kind: "switch", retained: false });
  await flush();
  await flush();
  assert.deepEqual(calls.sent.at(-1), { id, on: false });
  assert.deepEqual(calls.notes.at(-1), { id, on: false, who: "Nexternel" });
  assert.match(calls.activity.at(-1)!, /came on after its press had got no answer/);
});

test("an 'off' press without an answer says it may not have switched", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id)] });
  setLiveState(id, true);
  const press = path.switchItem(id, "off");
  await flush();
  mock.timers.tick(SWITCH_ANSWER_MS);
  await assert.rejects(press, /it may not have switched/);
  assert.equal(calls.notes.length, 0, "no person, nothing noted");
});

test("a switch already in that position answers straight away", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id)] });
  setLiveState(id, true);
  assert.deepEqual(await path.switchItem(id, "on"), { value: true });
  assert.equal(calls.sent.length, 1);
});

test("toggle goes to the other position", async () => {
  const id = newId();
  const { path } = setup({ items: [makeItem(id)] });
  setLiveState(id, true);
  const press = path.switchItem(id, "toggle");
  await flush();
  path.reportItem(id, false, { kind: "switch", retained: false });
  assert.deepEqual(await press, { value: false });
});

test("no press goes out while the connection is down", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id)], unavailable: "MQTT not connected" });
  await assert.rejects(path.switchItem(id, "on"), /MQTT not connected/);
  assert.equal(calls.sent.length, 0);
});

test("a send that fails is reported and leaves nothing waiting", async () => {
  const id = newId();
  const { path } = setup({ items: [makeItem(id)], sendFails: true });
  await assert.rejects(path.switchItem(id, "on"), /send failed/);
});

test("items that cannot be switched are refused", async () => {
  const sensor = newId();
  const noTopic = newId();
  const { path } = setup({ items: [makeItem(sensor, { kind: "temperature", source_type: "sensor" }), makeItem(noTopic, { command_topic: null })] });
  await assert.rejects(path.switchItem("missing", "on"), /Item not found/);
  await assert.rejects(path.switchItem(sensor, "on"), /not a switch/);
  await assert.rejects(path.switchItem(noTopic, "on"), /cannot be switched/);
});

test("an extension's switch counts only once the extension reports it", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id, { firmware_type: "plugin", connection: "extension", command_topic: null })] });
  const press = path.switchItem(id, "on", "rey");
  await flush();
  assert.deepEqual(calls.sent, [{ id, on: true }]);
  assert.equal(getLiveState(id)?.value, undefined);
  path.reportItem(id, true, { kind: "switch", retained: false });
  assert.deepEqual(await press, { value: true });
});

const heating = (id: string, over: Partial<CapabilityRow> = {}) =>
  makeItem(id, { name: "Heating", kind: "thermostat", source_type: "control", connection: "extension", command_topic: null, ...over });
const thermostat = (over: Partial<ControlInfo["features"]> = {}): ControlInfo => ({
  type: "thermostat",
  features: { min: 5, max: 30, step: 0.5, presets: ["Eco"], ...over } as ControlInfo["features"],
});

test("a control change counts once the device's report shows all of it", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [heating(id)], controls: { [id]: thermostat() } });
  const change = path.setControl(id, { target: 21 }, "rey");
  await flush();
  assert.deepEqual(calls.changes, [{ id, change: { target: 21 } }]);
  assert.equal(path.reportControl(id, { current: 19 }), true);
  await flush();
  assert.equal(calls.activity.length, 0);
  path.reportControl(id, { target: 21 });
  assert.deepEqual(await change, { current: 19, target: 21 });
  assert.deepEqual(calls.activity, ["Garden Relays · Heating set to 21°"]);
  assert.deepEqual(calls.touchedItems, [id]);
});

test("a control change without an answer: the 'on' is cancelled, and a late 'on' is switched off again", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [heating(id)], controls: { [id]: thermostat() } });
  const change = path.setControl(id, { on: true }, "rey");
  await flush();
  mock.timers.tick(SWITCH_ANSWER_MS);
  await assert.rejects(change, (e: unknown) => e instanceof NotConfirmedError && /so this press was cancelled/.test(e.message));
  path.reportControl(id, { on: true });
  await flush();
  assert.deepEqual(calls.changes.at(-1), { id, change: { on: false } });
  assert.match(calls.activity.at(-1)!, /came on after its press had got no answer/);
});

test("a device reached over its maker's internet service has longer to answer", async () => {
  const id = newId();
  const { path } = setup({ items: [heating(id)], controls: { [id]: thermostat({ internet: true }) } });
  const change = path.setControl(id, { target: 20 }, "rey");
  await flush();
  mock.timers.tick(SWITCH_ANSWER_MS);
  path.reportControl(id, { target: 20 });
  assert.deepEqual(await change, { target: 20 });
  assert.ok(INTERNET_ANSWER_MS > SWITCH_ANSWER_MS);
});

test("control changes the device cannot do are refused, and nothing is sent", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [heating(id)], controls: { [id]: thermostat() } });
  await assert.rejects(path.setControl("missing", { target: 20 }, "rey"), ControlRefusedError);
  await assert.rejects(path.setControl(id, { brightness: 50 }, "rey"), ControlRefusedError);
  assert.equal(calls.changes.length, 0);
});

test("a control change that fails to send leaves nothing waiting", async () => {
  const id = newId();
  const { path } = setup({ items: [heating(id)], controls: { [id]: thermostat() }, sendFails: true });
  await assert.rejects(path.setControl(id, { target: 20 }, "rey"), /send failed/);
});

test("a control report that is not understood is refused", () => {
  const { path } = setup();
  assert.equal(path.reportControl(newId(), { nonsense: 1 }), false);
  assert.equal(path.reportControl(newId(), "on"), false);
});

test("each device goes through the connection it has recorded", () => {
  assert.equal(connectionOf({ connection: "extension" }), "extension");
  assert.equal(connectionOf({ connection: "mqtt" }), "mqtt");
  assert.equal(connectionOf({ connection: "zherodius" }), "zherodius");
});

test("over MQTT a switch needs its command address; other connections need none", () => {
  assert.equal(canCommand({ connection: "mqtt", source_type: "relay", command_topic: "x/switch/a/command" }), true);
  assert.equal(canCommand({ connection: "mqtt", source_type: "relay", command_topic: null }), false);
  assert.equal(canCommand({ connection: "mqtt", source_type: "relay", command_topic: "" }), false);
  assert.equal(canCommand({ connection: "zherodius", source_type: "relay", command_topic: null }), true);
  assert.equal(canCommand({ connection: "extension", source_type: "control", command_topic: null }), true);
  assert.equal(canCommand({ connection: "zherodius", source_type: "sensor", command_topic: null }), false);
  assert.equal(canCommand({ connection: "octopus", source_type: "sensor", command_topic: null }), false);
});

test("a Zherodius switch without any MQTT address can be pressed", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id, { connection: "zherodius", firmware_type: "zherodius", command_topic: null })] });
  const press = path.switchItem(id, "on");
  await flush();
  assert.deepEqual(calls.sent, [{ id, on: true }]);
  path.reportItem(id, true, { kind: "switch", retained: false });
  assert.deepEqual(await press, { value: true });
});

test("a sensor reading: live value, history, device heard from", () => {
  const id = newId();
  const { path, calls } = setup();
  path.reportItem(id, 21.5, { kind: "temperature", retained: false, history: { deviceSlug: "hall", entityId: "temp" } });
  assert.equal(getLiveState(id)?.value, 21.5);
  assert.equal(getLiveState(id)?.quality, "good");
  assert.deepEqual(calls.history, [{ deviceSlug: "hall", entityId: "temp", value: 21.5 }]);
  assert.deepEqual(calls.touchedItems, [id]);
});

test("a replayed (kept) reading equal to the held one changes nothing", () => {
  const id = newId();
  const { path, calls } = setup();
  path.reportItem(id, 21.5, { kind: "temperature", retained: false });
  const held = getLiveState(id)!;
  mock.timers.tick(60_000);
  path.reportItem(id, 21.5, { kind: "temperature", retained: true, history: { deviceSlug: "hall", entityId: "temp" } });
  assert.equal(getLiveState(id)!.updatedAt, held.updatedAt);
  assert.equal(calls.history.length, 0, "kept values are not history");
  assert.equal(calls.touchedItems.length, 1, "a kept sensor value is no proof the device is there");
});

test("a new replayed reading is shown as not current", () => {
  const id = newId();
  const { path } = setup();
  path.reportItem(id, 19, { kind: "temperature", retained: true });
  assert.equal(getLiveState(id)?.quality, "stale");
});

test("'nan' means the sensor cannot read; the Activity log says so once, and when it reads again", () => {
  const id = newId();
  const { path, calls } = setup();
  path.reportItem(id, "nan", { kind: "temperature", retained: false, history: { deviceSlug: "hall", entityId: "temp" } });
  path.reportItem(id, "nan", { kind: "temperature", retained: false });
  assert.equal(getLiveState(id)?.value, null);
  assert.equal(getLiveState(id)?.quality, "error");
  path.reportItem(id, 20, { kind: "temperature", retained: false });
  assert.deepEqual(calls.sensorAnswers, [{ id, answering: false }, { id, answering: true }]);
  assert.equal(calls.history.length, 0, "no number, no history");
});

test("switch changes from the board go into the Activity log; replays do not", () => {
  const id = newId();
  const { path, calls } = setup();
  path.reportItem(id, false, { kind: "switch", retained: true });
  path.reportItem(id, true, { kind: "switch", retained: true });
  path.reportItem(id, false, { kind: "switch", retained: false });
  assert.deepEqual(calls.switchChanges, [{ id, on: false }]);
  assert.equal(calls.positions.length, 3);
  assert.equal(calls.touchedItems.length, 1, "touches are written at most every 15 s");
});

test("being heard from marks a device online at most every 15 s", () => {
  const { path, calls } = setup();
  path.deviceHeard(["d1"]);
  path.deviceHeard(["d1"]);
  mock.timers.tick(15_000);
  path.deviceHeard(["d1"]);
  assert.deepEqual(calls.online, [
    { ids: ["d1"], online: true },
    { ids: ["d1"], online: true },
  ]);
});

test("a device going offline makes its current values not current", async () => {
  const id = newId();
  const { path, calls } = setup({ items: [makeItem(id)] });
  setLiveState(id, true);
  path.deviceOffline(["dev-1"]);
  await flush();
  assert.deepEqual(calls.online, [{ ids: ["dev-1"], online: false }]);
  assert.equal(getLiveState(id)?.quality, "stale");
  assert.equal(getLiveState(id)?.value, true);
});

test("no device, nothing written", () => {
  const { path, calls } = setup();
  path.deviceOnline([]);
  path.deviceOffline([]);
  path.deviceHeard([]);
  assert.equal(calls.online.length, 0);
});

test("live values not renewed for 3 minutes turn not current", async () => {
  const id = newId();
  const { path } = setup();
  setLiveState(id, 5);
  mock.timers.tick(180_001);
  await path.sweepFreshness();
  assert.equal(getLiveState(id)?.quality, "stale");
});
