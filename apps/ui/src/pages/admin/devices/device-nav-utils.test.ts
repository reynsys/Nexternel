import { test } from "node:test";
import assert from "node:assert/strict";
import { octopusState, OCTOPUS_STATUS } from "./device-nav-utils.ts";
import type { OctopusSettingsPublic } from "../../../api.ts";

const base: OctopusSettingsPublic = {
  accountNumber: "", hasApiKey: false, electricityDeviceId: "", gasDeviceId: "", enabled: false,
  pollIntervalSec: 60, lastPollAt: null, lastError: null, deviceRegistered: false,
};

test("Octopus row tells the truth: never 'Working' unless set up and without an error", () => {
  assert.equal(octopusState(base), "not_set_up"); // a new home that has no Octopus
  assert.equal(octopusState({ ...base, accountNumber: "A-1", hasApiKey: true }), "switched_off");
  assert.equal(octopusState({ ...base, enabled: true, accountNumber: "A-1", hasApiKey: true }), "working");
  assert.equal(octopusState({ ...base, enabled: true, lastError: "401" }), "needs_attention");
  assert.equal(octopusState(null), "unknown"); // settings could not be read
  assert.equal(OCTOPUS_STATUS.unknown.tone, "warn");
  assert.equal(OCTOPUS_STATUS.not_set_up.word, "Not set up");
});
