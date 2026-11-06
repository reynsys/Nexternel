import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMapContent, timeAgo } from "./map-panel-content.ts";

test("bad JSON gives an empty map", () => {
  assert.deepEqual(parseMapContent("not json"), { markers: [], trail: [], note: "" });
  assert.deepEqual(parseMapContent("null"), { markers: [], trail: [], note: "" });
});

test("places outside the world are left out", () => {
  const c = parseMapContent(
    JSON.stringify({
      markers: [
        { id: "a", label: "Car", lat: 51.5, lon: -0.1, at: "2026-11-06T08:00:00Z", detail: "Parked", heading: 90 },
        { id: "b", lat: 95, lon: 0 },
        { id: "c", lat: "51", lon: 0 },
      ],
      trail: [[51.5, -0.1], [51.5], [200, 0], "x"],
      note: "Cannot reach the server",
    })
  );
  assert.equal(c.markers.length, 1);
  assert.equal(c.markers[0].label, "Car");
  assert.equal(c.markers[0].heading, 90);
  assert.deepEqual(c.trail, [[51.5, -0.1]]);
  assert.equal(c.note, "Cannot reach the server");
});

test("a bad time is dropped, the place is kept", () => {
  const c = parseMapContent(JSON.stringify({ markers: [{ lat: 1, lon: 2, at: "soon" }] }));
  assert.equal(c.markers[0].at, null);
});

test("time ago reads naturally", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  assert.equal(timeAgo("2026-11-06T11:59:40Z", now), "just now");
  assert.equal(timeAgo("2026-11-06T11:55:00Z", now), "5 min ago");
  assert.equal(timeAgo("2026-11-06T09:00:00Z", now), "3 h ago");
  assert.equal(timeAgo("2026-11-03T12:00:00Z", now), "3 days ago");
});
