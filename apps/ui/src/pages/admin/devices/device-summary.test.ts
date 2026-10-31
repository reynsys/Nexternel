import assert from "node:assert/strict";
import test from "node:test";
import type { Capability, DeviceRecord } from "../../../api";
import { deviceStatus, deviceSummary } from "./device-summary.ts";

const dev = (over: Partial<DeviceRecord> = {}): DeviceRecord =>
  ({ id: "d", roomId: null, roomName: null, name: "Board", slug: "b", mqttTopicPrefix: "n/b", esphomeName: null, ipAddress: null, macAddress: null, isEnabled: true, isOnline: true, connectivityState: "online", lastSeenAt: null, sensors: [], relays: [], ...over }) as DeviceRecord;
const sensor = (id: string, unit: string) => ({ id, name: id, slug: id, sensorType: "temperature", unit, esphomeEntityId: null, mqttStateTopic: "", isEnabled: true, capabilityId: id });
const relay = (id: string, lastState: string) => ({ id, name: id, slug: id, esphomeEntityId: null, mqttCommandTopic: "", mqttStateTopic: "", lastState, isEnabled: true });

test("the list summary: live values, switches, or how many readings when there are no values", () => {
  const values = new Map<string, Capability>([["t", { id: "t", unit: "°C", state: { value: 21.43, quality: "good", updatedAt: "" } } as Capability]]);
  assert.equal(deviceSummary(dev({ sensors: [sensor("t", "°C")] }), values), "21.4 °C");
  assert.equal(deviceSummary(dev({ sensors: [sensor("x", "%"), sensor("y", "%")] }), values), "2 readings");
  assert.equal(deviceSummary(dev({ relays: [relay("a", "OFF"), relay("b", "ON")] as DeviceRecord["relays"] }), values), "2 switches · 1 on");
});

test("one status word: switched off, offline, update ready, online", () => {
  assert.equal(deviceStatus(dev({ isEnabled: false })).word, "Switched off");
  assert.equal(deviceStatus(dev({ connectivityState: "offline" })).word, "Offline");
  assert.equal(deviceStatus(dev(), { updateState: "update" } as never).word, "Update ready");
  assert.equal(deviceStatus(dev()).word, "Online");
});
