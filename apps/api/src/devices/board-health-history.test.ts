import assert from "node:assert/strict";
import test from "node:test";
import { summarizeHealth } from "./board-health-history.js";

const at = (min: number) => new Date(Date.UTC(2026, 10, 5, 8, min)).toISOString();

test("every report arrived: one line, nothing missing", () => {
  const h = summarizeHealth(
    [
      { at: at(0), rssi: -60, mqttDrops: 4 },
      { at: at(1), rssi: -62, mqttDrops: 4 },
      { at: at(2), rssi: -61, mqttDrops: 5 },
    ],
    new Date(at(2))
  );
  assert.equal(h.points.length, 3);
  assert.deepEqual([h.received, h.expected, h.weakest, h.strongest, h.mqttDrops], [3, 3, -62, -60, 1]);
});

test("reports that did not arrive leave a gap in the line and count as missing", () => {
  const h = summarizeHealth(
    [
      { at: at(0), rssi: -60, mqttDrops: 0 },
      { at: at(20), rssi: -61, mqttDrops: 7 },
    ],
    new Date(at(40))
  );
  assert.deepEqual(h.points.map((p) => p.rssi), [-60, null, -61, null]);
  assert.deepEqual([h.received, h.expected, h.mqttDrops], [2, 41, 7]);
});

test("a board that restarted starts counting its drops from zero again", () => {
  const h = summarizeHealth(
    [
      { at: at(0), rssi: -60, mqttDrops: 9 },
      { at: at(1), rssi: -60, mqttDrops: 1 },
      { at: at(2), rssi: -60, mqttDrops: 3 },
    ],
    new Date(at(2))
  );
  assert.equal(h.mqttDrops, 2);
});

test("no reports: nothing to say", () => {
  assert.deepEqual(summarizeHealth([]), { points: [], received: 0, expected: 0, weakest: null, strongest: null, mqttDrops: 0 });
});
