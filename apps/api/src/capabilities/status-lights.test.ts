import assert from "node:assert/strict";
import test from "node:test";
import { parseStatusSettings, StatusEngine, STATUS_SETTLE_MS, type StatusEvent } from "./status-lights.js";

function setup() {
  let t = 1_000_000;
  const notes: { level: string; title: string; body: string }[] = [];
  const events: StatusEvent[] = [];
  const engine = new StatusEngine(
    async (n) => notes.push(n),
    () => t
  );
  engine.subscribe((e) => events.push(e));
  engine.configure(
    [
      { id: "temp", kind: "temperature", name: "Temperature", area: "Living Room", unit: "°C" },
      { id: "power", kind: "power", name: "Power", area: null, unit: "W" },
    ],
    new Map()
  );
  const advance = (ms: number) => {
    t += ms;
    engine.sweep();
  };
  return { engine, notes, events, advance };
}

test("the first reading shows its colour straight away", () => {
  const { engine } = setup();
  engine.update({ capabilityId: "temp", value: 21, quality: "good" });
  assert.equal(engine.get("temp")?.state, "ok");
});

test("a colour only changes after the reading has stayed past a limit for a minute", () => {
  const { engine, advance } = setup();
  engine.update({ capabilityId: "temp", value: 21, quality: "good" });
  engine.update({ capabilityId: "temp", value: 25, quality: "good" });
  advance(30_000);
  assert.equal(engine.get("temp")?.state, "ok");
  // Back inside the limits before the minute is up: no change at all.
  engine.update({ capabilityId: "temp", value: 23, quality: "good" });
  advance(STATUS_SETTLE_MS);
  assert.equal(engine.get("temp")?.state, "ok");
  engine.update({ capabilityId: "temp", value: 25, quality: "good" });
  advance(STATUS_SETTLE_MS);
  assert.equal(engine.get("temp")?.state, "watch");
});

test("no recent reading turns grey at once", () => {
  const { engine } = setup();
  engine.update({ capabilityId: "temp", value: 21, quality: "good" });
  engine.update({ capabilityId: "temp", value: 21, quality: "stale" });
  assert.equal(engine.get("temp")?.state, "stale");
});

test("readings without limits have no light", () => {
  const { engine } = setup();
  engine.update({ capabilityId: "power", value: 900, quality: "good" });
  assert.equal(engine.get("power")?.state, null);
  assert.deepEqual(
    engine.all().map((s) => s.capabilityId),
    ["temp"]
  );
});

test("a reading that stays at act now rings the bell once, then says when it is back to normal", () => {
  const { engine, notes, advance } = setup();
  engine.update({ capabilityId: "temp", value: 21, quality: "good" });
  engine.update({ capabilityId: "temp", value: 28.4, quality: "good" });
  advance(STATUS_SETTLE_MS);
  assert.equal(engine.get("temp")?.state, "alert");
  advance(9 * 60_000);
  assert.equal(notes.length, 0);
  advance(60_000);
  assert.equal(notes.length, 1);
  assert.equal(notes[0]!.title, "Living Room Temperature: act now");
  assert.match(notes[0]!.body, /28\.4 °C, above 27 °C for 10 minutes/);
  advance(60_000);
  assert.equal(notes.length, 1);
  engine.update({ capabilityId: "temp", value: 22, quality: "good" });
  advance(STATUS_SETTLE_MS);
  assert.equal(notes.length, 2);
  assert.equal(notes[1]!.level, "info");
  assert.match(notes[1]!.title, /back to normal/);
});

test("changed limits apply straight away and are announced", () => {
  const { engine, events } = setup();
  engine.update({ capabilityId: "temp", value: 23, quality: "good" });
  events.length = 0;
  engine.configure(
    [{ id: "temp", kind: "temperature", name: "Temperature", area: "Living Room", unit: "°C" }],
    new Map([["temp", { enabled: true, limits: { watchHigh: 22, alertHigh: 26 }, notifyAfterMin: null }]])
  );
  assert.equal(engine.get("temp")?.state, "watch");
  assert.equal(engine.get("temp")?.custom, true);
  assert.equal(events.length, 1);
});

test("settings from a screen are checked", () => {
  assert.deepEqual(parseStatusSettings({ limits: { watchHigh: "1000", alertHigh: 2000 }, notifyAfterMin: 5 }), {
    enabled: true,
    limits: { alertLow: null, watchLow: null, watchHigh: 1000, alertHigh: 2000 },
    notifyAfterMin: 5,
  });
  assert.throws(() => parseStatusSettings({ limits: { watchHigh: 30, alertHigh: 20 } }), /must not be lower/);
  assert.throws(() => parseStatusSettings({ notifyAfterMin: 0 }), /1 to 1440/);
});
