import assert from "node:assert/strict";
import test from "node:test";
import {
  CONNECTIVITY_NO_RECENT_MS,
  CONNECTIVITY_SWITCH_ACTIVE_MS,
  deriveDeviceConnectivityState,
  type ConnectivityInput,
} from "./connectivity.js";

const base: ConnectivityInput = {
  firmwareType: "esphome",
  isEnabled: true,
  mqttAvailability: "unknown",
  lastSeenAt: null,
  sensorCount: 0,
  relayCount: 1,
  capabilityLive: [],
};

test("explicit MQTT offline → offline", () => {
  assert.equal(
    deriveDeviceConnectivityState({
      ...base,
      mqttAvailability: "offline",
      lastSeenAt: new Date().toISOString(),
    }),
    "offline"
  );
});

test("switch with recent last_seen → online", () => {
  assert.equal(
    deriveDeviceConnectivityState({
      ...base,
      lastSeenAt: new Date(Date.now() - 60_000).toISOString(),
    }),
    "online"
  );
});

test("switch idle 2h → no_recent_data not offline", () => {
  assert.equal(
    deriveDeviceConnectivityState({
      ...base,
      lastSeenAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    }),
    "no_recent_data"
  );
});

test("switch silent 25h without explicit online → offline", () => {
  assert.equal(
    deriveDeviceConnectivityState({
      ...base,
      lastSeenAt: new Date(Date.now() - CONNECTIVITY_NO_RECENT_MS - 60_000).toISOString(),
    }),
    "offline"
  );
});

test("fresh live capability → online even when last_seen is old", () => {
  assert.equal(
    deriveDeviceConnectivityState({
      ...base,
      lastSeenAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(),
      capabilityLive: [
        {
          kind: "switch",
          quality: "good",
          updatedAt: new Date(Date.now() - 30_000).toISOString(),
        },
      ],
    }),
    "online"
  );
});

test("never seen → no_recent_data", () => {
  assert.equal(deriveDeviceConnectivityState({ ...base, lastSeenAt: null }), "no_recent_data");
});

test("a quiet ESPHome or Shelly board that says it is online → online", () => {
  for (const firmwareType of ["esphome", "shelly"]) {
    assert.equal(
      deriveDeviceConnectivityState({
        ...base,
        firmwareType,
        mqttAvailability: "online",
        lastSeenAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
      }),
      "online"
    );
  }
});

test("other devices online but quiet 2h → no_recent_data (they do not announce dropping out)", () => {
  assert.equal(
    deriveDeviceConnectivityState({
      ...base,
      firmwareType: "plugin",
      mqttAvailability: "online",
      lastSeenAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    }),
    "no_recent_data"
  );
});

test("switch active window boundary", () => {
  const inside = deriveDeviceConnectivityState({
    ...base,
    nowMs: Date.now(),
    lastSeenAt: new Date(Date.now() - CONNECTIVITY_SWITCH_ACTIVE_MS + 5_000).toISOString(),
  });
  assert.equal(inside, "online");

  const outside = deriveDeviceConnectivityState({
    ...base,
    nowMs: Date.now(),
    lastSeenAt: new Date(Date.now() - CONNECTIVITY_SWITCH_ACTIVE_MS - 5_000).toISOString(),
  });
  assert.equal(outside, "no_recent_data");
});
