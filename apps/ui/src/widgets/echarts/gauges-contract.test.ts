import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { GAUGE_PRESETS } from "./presets/gauges.ts";
import type { EchartsBuildCtx } from "./types.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const gaugesSource = readFileSync(join(dir, "presets", "gauges.ts"), "utf8");

function ctx(partial: Partial<EchartsBuildCtx> = {}): EchartsBuildCtx {
  return {
    value: 21.5,
    unit: "°C",
    title: "Hallway Temperature",
    kind: "temperature",
    min: 0,
    max: 60,
    points: [],
    range: "24h",
    ...partial,
  };
}

test("the scaling layer is gone", () => {
  assert.doesNotMatch(gaugesSource, /gaugeScale/);
  assert.doesNotMatch(gaugesSource, /EDITOR_SHORT_SIDE|DEMO_SHORT_SIDE/);
  assert.doesNotMatch(gaugesSource, /function px\(/);
  assert.doesNotMatch(gaugesSource, /applyGaugePresentation|enforceAllGaugeSeries/);
});

test("old demo dials that are not a sensor reading stay gone", () => {
  const ids = GAUGE_PRESETS.map((p) => p.id);
  for (const id of [
    "gauge-car",
    "gauge-clock",
    "gauge-grade",
    "gauge-multi-title",
    "gauge-speed",
    "gauge-stage",
    "gauge-simple",
  ]) {
    assert.equal(ids.includes(id), false, id);
  }
});

type Drawn = { type: string; style?: { text?: string }; x?: number; y?: number };

/** The numbers written round a dial, in order. */
function numbers(id: string, extra: Partial<EchartsBuildCtx> = {}): string[] {
  const option = GAUGE_PRESETS.find((p) => p.id === id)!.buildOption(ctx(extra)) as {
    graphic: { elements: Drawn[] };
  };
  return option.graphic.elements.filter((e) => e.type === "text").map((e) => e.style!.text!);
}

test("dial numbers are tidy, even steps, in kW once watts reach a thousand", () => {
  const big = { tileWidth: 400, tileHeight: 400 };
  assert.deepEqual(numbers("gauge", { ...big, unit: "W", value: 1345, min: 0, max: 5000 }), ["0", "1", "2", "3", "4", "5"]);
  // An untidy top end keeps tidy numbers (no 518, 1036 …).
  assert.deepEqual(numbers("gauge", { ...big, unit: "W", value: 1345, min: 0, max: 5180 }), ["0", "1", "2", "3", "4", "5"]);
  assert.deepEqual(numbers("gauge", { ...big, unit: "°C", min: 0, max: 40 }).slice(0, 3), ["0", "10", "20"]);
  // Small dials show fewer numbers, still evenly spaced: never 2000, 4000, 5000.
  for (const size of [110, 140, 180, 220, 300]) {
    const shown = numbers("gauge", { tileWidth: size, tileHeight: size, unit: "W", value: 1345, min: 0, max: 5000 }).map(Number);
    assert.ok(shown.length >= 2, `${size}: ${shown}`);
    const steps = shown.slice(1).map((v, i) => Number((v - shown[i]).toFixed(6)));
    assert.equal(new Set(steps).size, 1, `${size}: uneven ${shown}`);
  }
});

test("dial numbers never touch each other", () => {
  for (const preset of GAUGE_PRESETS) {
    for (const size of [120, 200, 300]) {
      const option = preset.buildOption(ctx({ tileWidth: size, tileHeight: size, unit: "W", value: 1345, min: 0, max: 5000 })) as {
        graphic: { elements: Array<Drawn & { style: { text: string; fontSize: number } }> };
      };
      const labels = option.graphic.elements.filter((e) => e.type === "text");
      for (let i = 1; i < labels.length; i++) {
        const a = labels[i - 1];
        const b = labels[i];
        const font = a.style.fontSize;
        const apart =
          Math.abs(a.x! - b.x!) >= (a.style.text.length + b.style.text.length) * font * 0.31 ||
          Math.abs(a.y! - b.y!) >= font;
        assert.ok(apart, `${preset.id} at ${size}: ${a.style.text} and ${b.style.text} touch`);
      }
      for (const l of labels) {
        assert.ok(l.x! >= 0 && l.x! <= size && l.y! >= 0 && l.y! <= size, `${preset.id} at ${size}: ${l.style.text} outside the tile`);
      }
    }
  }
});

test("ten dials share one layout", () => {
  assert.equal(GAUGE_PRESETS.length, 10);
  const tile = { tileWidth: 300, tileHeight: 300 };
  const series = (id: string, extra: Partial<EchartsBuildCtx> = {}) => {
    const option = GAUGE_PRESETS.find((p) => p.id === id)!.buildOption(ctx({ ...tile, ...extra })) as {
      series: Array<{
        radius: number;
        center: [number, number];
        startAngle: number;
        pointer: { show: boolean };
        detail: { fontSize: number; offsetCenter: [number, number] };
        data: Array<{ value: number }>;
      }>;
    };
    return option.series[0];
  };
  const needle = series("gauge", { min: 0, max: 5000 });
  const ring = series("gauge-ring");
  assert.ok(ring.radius > needle.radius);
  assert.ok(ring.radius > 120);
  assert.equal(ring.detail.offsetCenter[1], 0);
  assert.ok(needle.detail.offsetCenter[1] > 0);
  assert.notEqual(series("gauge-half").startAngle, series("gauge-barometer").startAngle);
  assert.equal(needle.pointer.show, true);
  assert.equal(series("gauge-progress").pointer.show, false);
  const small = series("gauge", { tileWidth: 120, tileHeight: 120 }).detail.fontSize;
  const large = series("gauge", { tileWidth: 400, tileHeight: 400 }).detail.fontSize;
  assert.ok(large > small);
  assert.equal(series("gauge").data[0].value, 21.5);
  const needleOnSquare = series("gauge");
  assert.ok(Math.abs(needleOnSquare.detail.offsetCenter[1] - needleOnSquare.radius * 0.5) < 3);
  const semi = series("gauge-temperature");
  const double = series("gauge-double");
  assert.equal(semi.detail.offsetCenter[1], double.detail.offsetCenter[1]);
  assert.ok(double.detail.fontSize <= semi.detail.fontSize);
  assert.ok(double.detail.fontSize <= series("gauge-progress").detail.fontSize);
  const shortReading = (id: string) =>
    series(id, { value: 5, unit: "°C" }).detail.fontSize;
  assert.equal(shortReading("gauge-progress"), shortReading("gauge-double"));
  assert.equal(shortReading("gauge-temperature"), shortReading("gauge-ring"));
  assert.ok(semi.center[1] > 180, "shallow arc is centred in the tile");
  // The whole dial (numbers and reading included) is centred: the needle hub sits mid-width.
  assert.ok(Math.abs(series("gauge").center[0] - 150) < 2);
  const meter = numbers("gauge-barometer", { ...tile, min: 0, max: 60 });
  assert.equal(meter.includes("0"), false, "a full circle writes the joining number once");
  assert.equal(meter[meter.length - 1], "60");
  const half = series("gauge-half", { tileWidth: 420, tileHeight: 220 });
  const halfBottom = half.center[1] + half.detail.offsetCenter[1] + half.detail.fontSize / 2;
  assert.ok(halfBottom <= 220);
  const semiWide = series("gauge-temperature", { tileWidth: 420, tileHeight: 220 });
  const semiBottom = semiWide.center[1] + semiWide.detail.offsetCenter[1] + semiWide.detail.fontSize / 2;
  assert.ok(semiBottom <= 220);
});

test("a longer reading comes down so it stays inside the opening", () => {
  const tile = { tileWidth: 280, tileHeight: 280 };
  const fontFor = (id: string, value: number, unit: string) => {
    const option = GAUGE_PRESETS.find((p) => p.id === id)!.buildOption(
      ctx({ ...tile, value, unit, min: 0, max: 5000 })
    ) as { series: Array<{ detail: { fontSize: number } }> };
    return option.series[0].detail.fontSize;
  };
  for (const id of GAUGE_PRESETS.map((p) => p.id)) {
    const shorter = fontFor(id, 985, "W");
    const longer = fontFor(id, 1071, "W");
    assert.ok(longer <= shorter, `${id}: ${longer} should be at most ${shorter}`);
    assert.ok(longer >= 8, id);
    const kwhShort = fontFor(id, 8, "kWh");
    const kwhLong = fontFor(id, 8.5, "kWh");
    assert.ok(kwhLong <= kwhShort, `${id}: ${kwhLong} kWh should be at most ${kwhShort}`);
  }
  assert.ok(
    fontFor("gauge-temperature", 8.5, "kWh") < fontFor("gauge-temperature", 8, "kWh"),
    "the decimal comes down on the semicircle"
  );
});

test("demo page sizes are not copied", () => {
  assert.doesNotMatch(gaugesSource, /fontSize:\s*80|fontSize:\s*60|maxWidth:\s*160|SCORE|Pressure/);
});
