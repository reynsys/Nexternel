import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
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
