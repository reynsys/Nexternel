import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allCapabilityIds,
  bindingsFromSlots,
  deviceIdsFromBindings,
  normalizePanelBindings,
  parseWidgetBindings,
  primaryCapabilityId,
} from "./widget-bindings.ts";

describe("normalizePanelBindings", () => {
  it("accepts canonical capability binding fields", () => {
    const normalized = normalizePanelBindings({
      capabilityId: "cap-1",
      capabilityIds: ["cap-1", "cap-2"],
      slots: { primary: "cap-1" },
    });
    assert.equal(normalized.capabilityId, "cap-1");
    assert.deepEqual(normalized.capabilityIds, ["cap-1", "cap-2"]);
    assert.deepEqual(normalized.slots, { primary: "cap-1" });
  });

  it("migrates legacy deviceId to deviceIds", () => {
    const normalized = normalizePanelBindings({
      deviceId: "dev-a",
      capabilityId: "cap-1",
    });
    assert.deepEqual(normalized.deviceIds, ["dev-a"]);
    assert.equal("deviceId" in normalized, false);
  });

  it("preserves unknown binding keys", () => {
    const normalized = normalizePanelBindings({
      capabilityId: "cap-1",
      timezone: "Europe/London",
    });
    assert.equal(normalized.timezone, "Europe/London");
  });

  it("is idempotent", () => {
    const raw = {
      capabilityIds: ["  cap-1  ", "cap-2", "cap-2"],
      deviceId: "dev-1",
    };
    const once = normalizePanelBindings(raw);
    const twice = normalizePanelBindings(once);
    assert.deepEqual(once, twice);
  });

  it("drops invalid capability list entries safely", () => {
    const normalized = normalizePanelBindings({
      capabilityIds: ["", "  ", "cap-ok"],
    });
    assert.deepEqual(normalized.capabilityIds, ["cap-ok"]);
    assert.equal(normalized.capabilityId, "cap-ok");
  });
});

describe("binding helpers", () => {
  it("primaryCapabilityId prefers capabilityId", () => {
    assert.equal(
      primaryCapabilityId({ capabilityId: "a", capabilityIds: ["b"] }),
      "a"
    );
  });

  it("allCapabilityIds dedupes across fields", () => {
    assert.deepEqual(
      allCapabilityIds({
        capabilityId: "a",
        slots: { x: "b" },
      }),
      ["a", "b"]
    );
  });

  it("bindingsFromSlots matches canonical parse", () => {
    const slots = bindingsFromSlots({ primary: "cap-1", secondary: "cap-2" });
    assert.equal(slots.capabilityId, "cap-1");
    assert.deepEqual(slots.slots, { primary: "cap-1", secondary: "cap-2" });
    assert.deepEqual(parseWidgetBindings(slots), slots);
  });

  it("deviceIdsFromBindings reads normalized deviceIds", () => {
    assert.deepEqual(
      deviceIdsFromBindings({ deviceId: "d1" }),
      ["d1"]
    );
  });
});
