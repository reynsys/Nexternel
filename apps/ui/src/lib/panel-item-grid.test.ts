import assert from "node:assert/strict";
import test from "node:test";
import { itemTilesFit } from "./panel-item-grid.ts";

test("one item is always a tile", () => {
  assert.equal(itemTilesFit({ count: 1, width: 40, height: 40 }), true);
});

test("three readings in a wide panel fit as tiles", () => {
  // Hallway Monitor at laptop size: about 620 × 160 inside the panel.
  assert.equal(itemTilesFit({ count: 3, width: 620, height: 160 }), true);
});

test("three readings in a phone-sized panel become a list", () => {
  assert.equal(itemTilesFit({ count: 3, width: 150, height: 120 }), false);
});

test("many readings wrap onto rows while they fit, then list", () => {
  assert.equal(itemTilesFit({ count: 6, width: 400, height: 200 }), true); // 3 × 2
  assert.equal(itemTilesFit({ count: 9, width: 400, height: 200 }), false); // would need 3 rows
});

test("stacked readings need room for every row", () => {
  assert.equal(itemTilesFit({ count: 3, width: 300, height: 290, direction: "down" }), true);
  assert.equal(itemTilesFit({ count: 3, width: 300, height: 200, direction: "down" }), false);
});

test("unmeasured panels keep tiles until a size is known", () => {
  assert.equal(itemTilesFit({ count: 4, width: 0, height: 0 }), true);
});
