import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySwitchSystem,
  classifySystemForCapability,
  defaultSystemForKind,
} from "./classification.js";

describe("classifySwitchSystem", () => {
  it("classifies pumps as water", () => {
    assert.equal(
      classifySwitchSystem({ capabilityName: "Pond pump relay" }),
      "water"
    );
  });

  it("classifies lights as lighting", () => {
    assert.equal(
      classifySwitchSystem({ capabilityName: "Garden spot light" }),
      "lighting"
    );
  });

  it("returns null when domain is unknown", () => {
    assert.equal(classifySwitchSystem({ capabilityName: "Relay 3" }), null);
  });
});

describe("classifySystemForCapability", () => {
  it("does not default generic switches to lighting", () => {
    assert.equal(classifySystemForCapability("switch", { capabilityName: "Relay 1" }), null);
  });

  it("still classifies brightness as lighting", () => {
    assert.equal(defaultSystemForKind("brightness"), "lighting");
  });

  it("never classifies to garden system", () => {
    assert.equal(
      classifySystemForCapability("switch", { capabilityName: "Garden relay" }),
      null
    );
  });
});
