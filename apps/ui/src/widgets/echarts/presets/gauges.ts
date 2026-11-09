import { VALUE_WEIGHT } from "../../../lib/appearance/type";
import type { EchartsBuildCtx, EchartsPreset } from "../types";
import { MIN_CHART_FONT, chartFont } from "../types";
import { scaleText, scaleUnit, stepValues, tidySteps } from "../../../lib/number-scale";

const GAUGE_SIZE = { w: 4, h: 4 } as const;

/** Width of one glyph as a fraction of the font size. Ticks and the reading share it. */
const GLYPH_WIDTH = 0.62;

/**
 * One layout for every dial.
 *
 * The arc is drawn as large as the main tile allows. The numbers round it are
 * tidy steps (lib/number-scale: 0, 1, 2 … kW), as many as fit without touching,
 * each the same distance outside the marks. A needle dial puts the reading in the open part of the arc, inside the
 * line, or under the dial when the arc is a full circle. A dial without a
 * needle keeps the reading in the centre. The size follows the tile, then
 * comes down when the number and the unit are wider than the opening, so the
 * reading stays inside the line. A full circle draws
 * the joining number once. The whole dial, numbers and reading included, is
 * centred in the tile.
 * Shapes differ by sweep, thickness, needle, and bands. Sizes do not.
 */

type Ink = {
  accent: string;
  soft: string;
  text: string;
  /** Colour of the reading (a big value). */
  value: string;
  muted: string;
  track: string;
  /** The Look's font, for the numbers round the dial. */
  font?: string;
};

type ReadingPlace = "center" | "gap" | "below";

type Shape = {
  id: string;
  label: string;
  description: string;
  start: number;
  end: number;
  clockwise?: boolean;
  pointer: boolean;
  progress: boolean;
  labels: boolean;
  ticks: boolean;
  bands?: boolean;
  round?: boolean;
  thick: boolean;
  minor?: number;
  inner?: boolean;
};

const SHAPES: Shape[] = [
  {
    id: "gauge",
    label: "Needle",
    description: "Three-quarter dial with a needle",
    start: 225,
    end: -45,
    pointer: true,
    progress: false,
    labels: true,
    ticks: true,
    thick: false,
  },
  {
    id: "gauge-progress",
    label: "Arc",
    description: "Thick open arc and a centred reading",
    start: 225,
    end: -45,
    pointer: false,
    progress: true,
    labels: false,
    ticks: false,
    thick: true,
    round: true,
  },
  {
    id: "gauge-temperature",
    label: "Semicircle",
    description: "Wide top arc and a centred reading",
    start: 200,
    end: -20,
    pointer: false,
    progress: true,
    labels: true,
    ticks: true,
    thick: true,
  },
  {
    id: "gauge-barometer",
    label: "Meter",
    description: "Full circle, fine ticks, reading under the dial",
    start: 90,
    end: -269,
    pointer: true,
    progress: false,
    labels: true,
    ticks: true,
    thick: false,
    minor: 5,
  },
  {
    id: "gauge-ring",
    label: "Ring",
    description: "Thin full ring and a centred reading",
    start: 90,
    end: -269,
    pointer: false,
    progress: true,
    labels: false,
    ticks: false,
    thick: false,
    round: true,
  },
  {
    id: "gauge-bands",
    label: "Bands",
    description: "Coloured zones and a needle",
    start: 225,
    end: -45,
    pointer: true,
    progress: false,
    labels: true,
    ticks: false,
    bands: true,
    thick: true,
  },
  {
    id: "gauge-half",
    label: "Half dial",
    description: "Top half only, with a needle",
    start: 180,
    end: 0,
    pointer: true,
    progress: false,
    labels: true,
    ticks: true,
    thick: true,
  },
  {
    id: "gauge-marks",
    label: "Marks",
    description: "Tick circle and an arc, no needle",
    start: 225,
    end: -45,
    pointer: false,
    progress: true,
    labels: true,
    ticks: true,
    thick: false,
  },
  {
    id: "gauge-reading",
    label: "Reading",
    description: "A large number and a thin arc",
    start: 225,
    end: -45,
    pointer: false,
    progress: true,
    labels: false,
    ticks: false,
    thick: false,
    round: true,
  },
  {
    id: "gauge-double",
    label: "Double arc",
    description: "An outer scale and an inner arc",
    start: 225,
    end: -45,
    pointer: false,
    progress: false,
    labels: true,
    ticks: true,
    thick: false,
    inner: true,
  },
];

function readingText(ctx: EchartsBuildCtx, v: number): string {
  if (ctx.noReading) return "—";
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return ctx.unit ? `${n} ${ctx.unit}` : n;
}

function glyphWidth(text: string, font: number): number {
  return text.length * font * GLYPH_WIDTH;
}

function inkOf(ctx: EchartsBuildCtx): Ink {
  const palette = ctx.palette;
  return {
    accent: ctx.accent || palette?.accent || "#1A73E8",
    soft: palette?.accentSoft || "rgba(26,115,232,0.45)",
    text: palette?.textPrimary || "#e8eaed",
    value: palette?.value || palette?.textPrimary || "#e8eaed",
    muted: palette?.textSecondary || "#9aa0a6",
    track: palette?.splitLine || "rgba(255,255,255,0.18)",
    font: palette?.fontFamily,
  };
}

function signedSweep(start: number, end: number, clockwise: boolean): number {
  let sweep = end - start;
  if (clockwise) {
    if (sweep >= 0) sweep -= 360;
  } else if (sweep <= 0) {
    sweep += 360;
  }
  return sweep;
}

/** Angles along the sweep. 0° is east, 90° is north. */
function sweepAngles(start: number, end: number, clockwise: boolean, steps: number): number[] {
  const sweep = signedSweep(start, end, clockwise);
  const angles: number[] = [];
  for (let i = 0; i <= steps; i++) angles.push(start + (sweep * i) / steps);
  return angles;
}

/** Where a value sits on the dial (degrees, 0° east, 90° north). */
function angleOf(v: number, ctx: EchartsBuildCtx, shape: Shape): number {
  const sweep = signedSweep(shape.start, shape.end, shape.clockwise !== false);
  const span = ctx.max - ctx.min || 1;
  const t = Math.min(1, Math.max(0, (v - ctx.min) / span));
  return shape.start + sweep * t;
}

/** Screen offset from the centre (y grows downwards). */
function polar(deg: number, dist: number): [number, number] {
  const t = (deg * Math.PI) / 180;
  return [Math.cos(t) * dist, -Math.sin(t) * dist];
}

function closesFullCircle(shape: Shape): boolean {
  return Math.abs(signedSweep(shape.start, shape.end, shape.clockwise !== false)) >= 359;
}

/** A needle keeps the number off the hub. Every other dial centres it. */
function readingPlace(shape: Shape): ReadingPlace {
  if (!shape.pointer) return "center";
  return closesFullCircle(shape) ? "below" : "gap";
}

/** How far below the centre, in radius units, the opening reaches before the stroke. */
function bowlDepth(shape: Shape): number {
  const down = (deg: number) => -Math.sin((deg * Math.PI) / 180);
  const rim = Math.max(down(shape.start), down(shape.end));
  return rim <= 0.08 ? 1 : rim;
}

/** Needle length, in radius units. */
const NEEDLE_LENGTH = 0.62;

/** How far below the hub the needle's tip can reach, in radius units (at the ends of the scale). */
function needleDepth(shape: Shape): number {
  const down = (deg: number) => -Math.sin((deg * Math.PI) / 180);
  return NEEDLE_LENGTH * Math.max(0, down(shape.start), down(shape.end));
}

function needleWidth(arc: number): number {
  return Math.max(2, Math.round(arc * 0.35));
}

/** True when this angle lies on the drawn arc. */
function onArc(deg: number, shape: Shape): boolean {
  const clockwise = shape.clockwise !== false;
  const sweep = signedSweep(shape.start, shape.end, clockwise);
  let delta = deg - shape.start;
  if (sweep < 0) {
    delta = ((delta % 360) + 360) % 360;
    if (delta !== 0) delta -= 360;
    return delta >= sweep - 0.01 && delta <= 0.01;
  }
  delta = ((delta % 360) + 360) % 360;
  return delta >= -0.01 && delta <= sweep + 0.01;
}

/** Clear hole inside the stroke. A double arc uses the inner stroke. */
function holeRadius(r: number, arcWidth: number, inner: boolean): number {
  if (!inner) return Math.max(8, r - arcWidth);
  const innerArc = Math.max(3, Math.round(arcWidth * 0.7));
  const innerR = Math.max(innerArc + 6, r - arcWidth - 8);
  return Math.max(8, innerR - innerArc);
}

/**
 * Width the reading may use at this distance below the centre.
 * Where the arc crosses that line, the wall is the inner edge. In the opening,
 * the wall is the tile.
 */
function openingWidth(sy: number, hole: number, tileHalf: number, shape: Shape): number {
  const tileW = Math.max(8, tileHalf * 2);
  if (Math.abs(sy) >= hole) {
    const dir = sy >= 0 ? -90 : 90;
    return onArc(dir, shape) ? 0 : tileW;
  }
  const xWall = Math.sqrt(Math.max(0, hole * hole - sy * sy));
  const left = (Math.atan2(-sy, -xWall) * 180) / Math.PI;
  const right = (Math.atan2(-sy, xWall) * 180) / Math.PI;
  let half = tileHalf;
  if (onArc(left, shape)) half = Math.min(half, xWall);
  if (onArc(right, shape)) half = Math.min(half, xWall);
  return Math.max(0, half * 2);
}

/** Narrowest opening across the height of the reading. */
function clearWidth(detailY: number, font: number, hole: number, tileHalf: number, shape: Shape): number {
  const y0 = detailY - font / 2;
  const y1 = detailY + font / 2;
  let width = Infinity;
  for (let i = 0; i <= 4; i++) {
    const sy = y0 + ((y1 - y0) * i) / 4;
    width = Math.min(width, openingWidth(sy, hole, tileHalf, shape));
  }
  return width;
}

/** One number round the dial: its text, angle, box, and the distance of its middle from the centre. */
type ScaleLabel = { text: string; angle: number; w: number; h: number; dist: number };

/** The marks and numbers round a dial at one size. */
type Scale = {
  /** Angles of the long marks (each has a number) and the short marks between them. */
  major: number[];
  minor: number[];
  labels: ScaleLabel[];
};

/** Short marks between two numbers: the step's own split (1 → 5, 2 → 4, 2.5 → 5, 5 → 5). */
function minorSplits(step: number, preferred?: number): number {
  if (preferred) return preferred;
  const mantissa = Number((step / 10 ** Math.floor(Math.log10(step))).toPrecision(3));
  return mantissa === 2 ? 4 : 5;
}

/**
 * The numbers round the dial at this size: the most tidy numbers that fit without touching.
 * Each number sits just outside the marks, its own size away (wide numbers further at the
 * sides, tall ones further at the top), so every number is the same distance from the arc.
 */
function scaleFor(ctx: EchartsBuildCtx, shape: Shape, r: number, font: number, tick: number, gap: number): Scale {
  const unit = scaleUnit(ctx.unit, Math.max(Math.abs(ctx.min), Math.abs(ctx.max)));
  const lo = ctx.min / unit.factor;
  const hi = ctx.max / unit.factor;
  const outer = r + (shape.ticks ? 1 + tick : 0);
  const full = closesFullCircle(shape);
  const pad = Math.max(2, font * 0.35);

  const labelOf = (v: number, step: number): ScaleLabel => {
    const text = scaleText(v, step);
    const angle = angleOf(v * unit.factor, ctx, shape);
    const w = glyphWidth(text, font);
    const h = font;
    const t = (angle * Math.PI) / 180;
    const dist = outer + gap + (Math.abs(Math.cos(t)) * w) / 2 + (Math.abs(Math.sin(t)) * h) / 2;
    return { text, angle, w, h, dist };
  };
  const touch = (a: ScaleLabel, b: ScaleLabel) => {
    const [ax, ay] = polar(a.angle, a.dist);
    const [bx, by] = polar(b.angle, b.dist);
    return Math.abs(ax - bx) < (a.w + b.w) / 2 + pad && Math.abs(ay - by) < (a.h + b.h) / 2 + pad;
  };
  const valuesFor = (step: number) => {
    let values = stepValues(lo, hi, step);
    // A full circle meets itself: the start and the end share one number.
    if (full && values.length > 1 && Math.abs(values[0] - lo) < step * 1e-6 && Math.abs(values[values.length - 1] - hi) < step * 1e-6) {
      values = values.slice(1);
    }
    return values;
  };
  const fits = (labels: ScaleLabel[]) => {
    for (let i = 1; i < labels.length; i++) if (touch(labels[i - 1], labels[i])) return false;
    if (full && labels.length > 2 && touch(labels[labels.length - 1], labels[0])) return false;
    return true;
  };

  // About seven numbers on a three-quarter dial, more on a full circle: enough to read, never crowded.
  const sweepDeg = Math.abs(signedSweep(shape.start, shape.end, shape.clockwise !== false));
  const most = Math.max(4, Math.round((7 * sweepDeg) / 270));
  let step = 0;
  let values: number[] = [];
  for (const s of tidySteps(hi - lo)) {
    const v = valuesFor(s);
    if (v.length > most) continue;
    if (v.length < 2) break;
    if (!shape.labels || fits(v.map((x) => labelOf(x, s)))) {
      step = s;
      values = v;
      break;
    }
  }
  if (!step) return { major: [], minor: [], labels: [] };

  const major = values.map((v) => angleOf(v * unit.factor, ctx, shape));
  let minor: number[] = [];
  if (shape.ticks) {
    const spacing = (outer * Math.PI * sweepDeg) / 180 / Math.max(1, (hi - lo) / step);
    for (const n of [minorSplits(step, shape.minor), 2]) {
      if (spacing / n < 4) continue;
      minor = stepValues(lo, hi, step / n)
        .filter((v) => Math.abs(v / step - Math.round(v / step)) > 1e-6)
        .map((v) => angleOf(v * unit.factor, ctx, shape));
      break;
    }
  }
  return { major, minor, labels: shape.labels ? values.map((v) => labelOf(v, step)) : [] };
}

type Box = { minX: number; maxX: number; minY: number; maxY: number };

function grow(box: Box, x0: number, x1: number, y0: number, y1: number) {
  box.minX = Math.min(box.minX, x0);
  box.maxX = Math.max(box.maxX, x1);
  box.minY = Math.min(box.minY, y0);
  box.maxY = Math.max(box.maxY, y1);
}

type Place = {
  cx: number;
  cy: number;
  r: number;
  arc: number;
  tick: number;
  labelFont: number;
  readingFont: number;
  detail: [number, number];
  hub: number;
  scale: Scale;
};

function place(ctx: EchartsBuildCtx, shape: Shape): Place {
  const reading = readingPlace(shape);
  const w = ctx.tileWidth && ctx.tileWidth > 0 ? ctx.tileWidth : 240;
  const h = ctx.tileHeight && ctx.tileHeight > 0 ? ctx.tileHeight : 240;
  const short = Math.min(w, h);
  // Clear of the panel's edge and its decoration, even on small panels.
  const edge = Math.max(6, Math.round(short * 0.03));
  // Dial numbers: never below readable (and they follow Text size); with no room for all, fewer are shown.
  const labelFont = Math.max(chartFont(ctx, MIN_CHART_FONT), Math.round(short * 0.05));
  const tick = shape.ticks ? Math.max(2, Math.round(short * 0.018)) : 0;
  const gap = shape.labels ? Math.max(3, Math.round(short * 0.015)) : edge;
  const arc = Math.max(2, Math.round(short * (shape.thick ? 0.055 : 0.018)));
  const hub = shape.pointer ? Math.max(6, arc) / 2 : 0;
  const readingGuess = Math.max(8, Math.round(short * (reading === "center" ? 0.2 : 0.14)));
  const availW = Math.max(16, w - edge * 2);
  const availH = Math.max(16, h - edge * 2);
  const clockwise = shape.clockwise !== false;
  const angles = sweepAngles(shape.start, shape.end, clockwise, 48);
  const text = readingText(ctx, ctx.value);

  const compose = (r: number) => {
    const scale = shape.labels || shape.ticks ? scaleFor(ctx, shape, r, labelFont, tick, gap) : { major: [], minor: [], labels: [] };
    const box: Box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    const outer = r + (shape.ticks ? 1 + tick : 0);
    for (const deg of angles) {
      const [x, y] = polar(deg, outer);
      grow(box, x, x, y, y);
    }
    if (reading !== "center") grow(box, -hub, hub, -hub, hub);
    for (const l of scale.labels) {
      const [x, y] = polar(l.angle, l.dist);
      grow(box, x - l.w / 2, x + l.w / 2, y - l.h / 2, y + l.h / 2);
    }

    const innerHole = Math.max(8, r - arc);
    const hole = holeRadius(r, arc, Boolean(shape.inner));
    const tileHalf = availW / 2;
    let verticalCap = readingGuess;
    if (reading === "center") {
      verticalCap = Math.max(8, Math.min(readingGuess, Math.round(innerHole * 0.72)));
    } else if (reading === "gap") {
      const rim = bowlDepth(shape) * innerHole;
      verticalCap = Math.min(readingGuess, Math.max(8, Math.round(rim - 2)));
    }
    const dialBottom = box.maxY;
    // Lowest point of the needle (its tip at either end of the scale, plus half its width and a gap).
    const needleClear = (radius: number) => (shape.pointer ? needleDepth(shape) * radius + needleWidth(arc) / 2 + 3 : 0);
    const detailFor = (font: number) => {
      if (reading === "center") return 0;
      if (reading === "gap") {
        const rim = bowlDepth(shape) * innerHole;
        const half = font / 2;
        // A needle dial lets the number reach into the open bottom of the dial, where the needle never goes.
        const limit = Math.max(half, shape.pointer ? rim : rim - half - 2);
        // Under the hub and below where the needle's tip can reach, so the needle never crosses it.
        return Math.round(Math.min(Math.max(r * 0.5, hub + 3 + half, needleClear(r) + half), limit));
      }
      return Math.round(dialBottom + gap + font / 2);
    };
    const fits = (font: number) => {
      const at = detailFor(font);
      if (reading === "gap" && at - font / 2 < Math.max(hub + 2, needleClear(r) - 1)) return false;
      const maxW = reading === "below" ? tileHalf * 2 : clearWidth(at, font, hole, tileHalf, shape);
      return glyphWidth(text, font) <= maxW + 0.5;
    };
    let readingFont = verticalCap;
    if (!fits(readingFont)) {
      let lo = 8;
      let hi = verticalCap;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
      readingFont = fits(lo) ? lo : 8;
    }
    const detailY = detailFor(readingFont);
    const half = glyphWidth(text, readingFont) / 2;
    grow(box, -half, half, detailY - readingFont / 2, detailY + readingFont / 2);
    return { r, scale, readingFont, detailY, box };
  };

  // The largest dial whose arc, numbers and reading all fit the tile.
  const fitsTile = (b: Box) => b.maxX - b.minX <= availW + 0.5 && b.maxY - b.minY <= availH + 0.5;
  let lo = arc + 6;
  let hi = Math.max(lo, Math.ceil(Math.max(availW, availH)));
  if (!fitsTile(compose(lo).box)) hi = lo;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fitsTile(compose(mid).box)) lo = mid;
    else hi = mid;
  }
  const r = fitsTile(compose(hi).box) ? hi : lo;
  const laid = compose(r);

  // The whole dial, numbers and reading included, centred in the tile.
  const cx = edge + availW / 2 - (laid.box.minX + laid.box.maxX) / 2;
  const cy = edge + availH / 2 - (laid.box.minY + laid.box.maxY) / 2;

  return {
    cx: Math.round(cx),
    cy: Math.round(cy),
    r,
    arc,
    tick,
    labelFont,
    readingFont: laid.readingFont,
    detail: [0, laid.detailY],
    hub,
    scale: laid.scale,
  };
}

/** The marks and numbers round the dial, drawn where `scaleFor` put them. */
function scaleGraphics(shape: Shape, laid: Place, ink: Ink): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const from = laid.r + 1;
  const mark = (deg: number, length: number, width: number) => {
    const [x1, y1] = polar(deg, from);
    const [x2, y2] = polar(deg, from + length);
    out.push({
      type: "line",
      silent: true,
      shape: { x1: laid.cx + x1, y1: laid.cy + y1, x2: laid.cx + x2, y2: laid.cy + y2 },
      style: { stroke: ink.muted, lineWidth: width },
    });
  };
  if (shape.ticks) {
    for (const deg of laid.scale.minor) mark(deg, Math.max(2, Math.round(laid.tick * 0.6)), 1);
    for (const deg of laid.scale.major) mark(deg, laid.tick, 2);
  }
  for (const l of laid.scale.labels) {
    const [x, y] = polar(l.angle, l.dist);
    out.push({
      type: "text",
      silent: true,
      x: laid.cx + x,
      y: laid.cy + y,
      style: {
        text: l.text,
        fill: ink.muted,
        fontSize: laid.labelFont,
        ...(ink.font ? { fontFamily: ink.font } : {}),
        align: "center",
        verticalAlign: "middle",
      },
    });
  }
  return out;
}

function seriesFor(
  ctx: EchartsBuildCtx,
  shape: Shape,
  laid: Place,
  ink: Ink,
  inner = false
) {
  const arc = inner ? Math.max(3, Math.round(laid.arc * 0.7)) : laid.arc;
  const radius = inner ? Math.max(arc + 6, laid.r - laid.arc - 8) : laid.r;
  return {
    type: "gauge",
    min: ctx.min,
    max: ctx.max,
    center: [laid.cx, laid.cy],
    radius,
    startAngle: shape.start,
    endAngle: shape.end,
    clockwise: shape.clockwise !== false,
    pointer: {
      show: shape.pointer && !inner,
      length: `${NEEDLE_LENGTH * 100}%`,
      width: needleWidth(laid.arc),
      itemStyle: { color: ink.text },
    },
    progress: {
      show: (shape.progress || inner) && !shape.bands,
      width: arc,
      roundCap: Boolean(shape.round) || inner,
      itemStyle: { color: ink.accent },
    },
    axisLine: {
      show: !inner,
      roundCap: Boolean(shape.round),
      lineStyle: {
        width: inner ? 0 : arc,
        color: shape.bands
          ? [
              [0.33, ink.track],
              [0.66, ink.soft],
              [1, ink.accent],
            ]
          : [[1, ink.track]],
      },
    },
    // Marks and numbers are drawn by scaleGraphics, so every dial spaces them the same way.
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    anchor:
      shape.pointer && !inner
        ? { show: true, size: laid.hub * 2, itemStyle: { color: ink.text } }
        : { show: false },
    title: { show: false },
    detail: inner
      ? { show: false }
      : {
          valueAnimation: true,
          offsetCenter: laid.detail,
          fontSize: laid.readingFont,
          fontWeight: VALUE_WEIGHT,
          // The reading is a big value: the scheme's value colour, like every panel.
          color: ink.value,
          formatter: (v: number) => readingText(ctx, v),
        },
    data: [{ value: ctx.value }],
  };
}

function buildGauge(shape: Shape): EchartsPreset {
  return {
    id: shape.id,
    label: shape.label,
    description: shape.description,
    family: "gauge",
    category: "sensors",
    dataMode: "live",
    needsCapability: true,
    defaultSize: GAUGE_SIZE,
    buildOption: (ctx) => {
      const laid = place(ctx, shape);
      const ink = inkOf(ctx);
      const series = [seriesFor(ctx, shape, laid, ink)];
      if (shape.inner) series.push(seriesFor(ctx, shape, laid, ink, true));
      return {
        tooltip: { formatter: () => readingText(ctx, ctx.value) },
        graphic: { elements: scaleGraphics(shape, laid, ink) },
        series,
      };
    },
  };
}

export const GAUGE_PRESETS: EchartsPreset[] = SHAPES.map(buildGauge);
