import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  humanizeTechnicalId,
  isTechnicalDisplayName,
  preferCatalogDisplayName,
} from "./display-name.js";

describe("isTechnicalDisplayName", () => {
  it("flags entity id stored as name", () => {
    assert.equal(
      isTechnicalDisplayName("utility_room_temperature", "utility_room_temperature"),
      true
    );
  });

  it("accepts human labels", () => {
    assert.equal(
      isTechnicalDisplayName("Utility Room Temperature", "utility_room_temperature"),
      false
    );
  });
});

describe("preferCatalogDisplayName", () => {
  it("keeps yaml friendly name", () => {
    assert.equal(
      preferCatalogDisplayName("Utility Room Temperature", "utility_room_temperature"),
      "Utility Room Temperature"
    );
  });

  it("title-cases technical id only when name is missing", () => {
    assert.equal(
      preferCatalogDisplayName("utility_room_temperature", "utility_room_temperature"),
      "Utility Room Temperature"
    );
  });
});

describe("humanizeTechnicalId", () => {
  it("writes particle sizes the usual way", () => {
    assert.equal(humanizeTechnicalId("pm_2_5"), "PM2.5");
    assert.equal(humanizeTechnicalId("pm_1_0"), "PM1.0");
    assert.equal(humanizeTechnicalId("pm_10_0"), "PM10");
    assert.equal(humanizeTechnicalId("air_quality_pm_2_5"), "Air Quality PM2.5");
  });
  it("keeps plain names and known abbreviations", () => {
    assert.equal(humanizeTechnicalId("living_room_co2"), "Living Room CO2");
    assert.equal(humanizeTechnicalId("utility_room_temperature"), "Utility Room Temperature");
    assert.equal(humanizeTechnicalId("wifi_signal"), "Wi-Fi Signal");
  });
});

describe("repairedName", async () => {
  const { repairedName } = await import("./ensure-schema.js");
  it("repairs names made automatically from the reading's own id", () => {
    assert.equal(repairedName("Pm 2 5", "air_quality_pm_2_5"), "PM2.5");
    assert.equal(repairedName("Pm 10 0", "pm_10_0"), "PM10");
  });
  it("never touches a name someone typed", () => {
    assert.equal(repairedName("Kitchen dust", "air_quality_pm_2_5"), null);
    assert.equal(repairedName("PM2.5", "air_quality_pm_2_5"), null);
    assert.equal(repairedName("Living Room Temperature", "living_room_temperature"), null);
  });
});
