import { VALUE_WEIGHT } from "../../../lib/appearance/type";
import type { EchartsBuildCtx, EchartsPreset } from "../types";
import { MIN_CHART_FONT, chartFont } from "../types";

const GAUGE_SIZE = { w: 4, h: 4 } as const;

/** Width of one glyph as a fraction of the font size. Ticks and the reading share it. */
const GLYPH_WIDTH = 0.62;

/**
 * One layout for every dial.
 *
 * The arc is drawn as large as the main tile allows. Tick numbers are anchored
 * outside the arc and drawn back toward it, so the whole number stays off the
 * line. A needle dial puts the reading in the open part of the arc, inside the
 * line, or under the dial when the arc is a full circle. A dial without a
 * needle keeps the reading in the centre. The size follows the tile, then
 * comes down when the number and the unit are wider than the opening, so the
 * reading stays inside the line. A full circle draws
 * the joining number once. A shallow arc is centred in the tile, so spare
 * room is not left under it.
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
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return ctx.unit ? `${n} ${ctx.unit}` : n;
}

function tickText(v: number): string {
  const nearest = Math.round(v);
  if (Math.abs(v - nearest) < 0.001) return String(nearest);
  return v.toFixed(1);
}

/** How many marks fit this range as whole numbers. */
function marksForRange(min: number, max: number): number {
  const span = max - min;
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000]) {
    const n = Math.round(span / step);
    if (n >= 6 && n <= 12 && Math.abs(span / step - n) < 0.001) return n;
  }
  return 10;
}

function widestTick(min: number, max: number, splits: number): string {
  let widest = "";
  for (let i = 0; i <= splits; i++) {
    const label = tickText(min + ((max - min) * i) / splits);
    if (label.length > widest.length) widest = label;
  }
  return widest;
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
  };
}

/** Angles along the sweep. 0° is east, 90° is north. */
function sweepAngles(start: number, end: number, clockwise: boolean, steps: number): number[] {
  const sweep = signedSweep(start, end, clockwise);
  const angles: number[] = [];
  for (let i = 0; i <= steps; i++) angles.push(start + (sweep * i) / steps);
  return angles;
}

function unitBounds(angles: number[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const deg of angles) {
    const t = (deg * Math.PI) / 180;
    const x = Math.cos(t);
    const y = Math.sin(t);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY };
}

type Place = {
  cx: number;
  cy: number;
  r: number;
  arc: number;
  tick: number;
  labelFont: number;
  /** Show every n-th number on the dial (1 = all): numbers stay readable instead of shrinking. */
  labelEvery: number;
  readingFont: number;
  splitDistance: number;
  labelDistance: number;
  detail: [number, number];
  hideMin: boolean;
};

/** How far below the centre, in radius units, the opening reaches before the stroke. */
function bowlDepth(shape: Shape): number {
  const down = (deg: number) => -Math.sin((deg * Math.PI) / 180);
  const rim = Math.max(down(shape.start), down(shape.end));
  return rim <= 0.08 ? 1 : rim;
}

function closesFullCircle(shape: Shape): boolean {
  return Math.abs(signedSweep(shape.start, shape.end, shape.clockwise !== false)) >= 359;
}

/** A needle keeps the number off the hub. Every other dial centres it. */
function readingPlace(shape: Shape): ReadingPlace {
  if (!shape.pointer) return "center";
  return closesFullCircle(shape) ? "below" : "gap";
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

function place(ctx: EchartsBuildCtx, shape: Shape): Place {
  const reading = readingPlace(shape);
  const w = ctx.tileWidth && ctx.tileWidth > 0 ? ctx.tileWidth : 240;
  const h = ctx.tileHeight && ctx.tileHeight > 0 ? ctx.tileHeight : 240;
  const short = Math.min(w, h);
  // Clear of the panel's edge and its decoration, even on small panels.
  const edge = Math.max(6, Math.round(short * 0.03));
  // Dial numbers: never below readable (and they follow Text size); with no room for all, fewer are shown.
  const labelFont = Math.max(chartFont(ctx, MIN_CHART_FONT), Math.round(short * 0.05));
  const splits = marksForRange(ctx.min, ctx.max);
  const labelW = shape.labels ? Math.ceil(glyphWidth(widestTick(ctx.min, ctx.max, splits), labelFont)) : 0;
  const tick = shape.ticks ? Math.max(2, Math.round(short * 0.018)) : 0;
  const gap = shape.labels ? Math.max(2, Math.round(short * 0.012)) : edge;
  const arc = Math.max(2, Math.round(short * (shape.thick ? 0.055 : 0.018)));
  const outward = shape.labels ? labelW + gap + tick : 0;

  const readingGuess = Math.max(8, Math.round(short * (reading === "center" ? 0.2 : 0.14)));
  const below = reading === "below" ? readingGuess + gap + edge : 0;
  const availW = Math.max(16, w - edge * 2);
  const availH = Math.max(16, h - edge * 2 - below);

  const clockwise = shape.clockwise !== false;
  const angles = sweepAngles(shape.start, shape.end, clockwise, 48);
  const bounds = unitBounds(angles);
  const spanX = Math.max(0.2, bounds.maxX - bounds.minX);
  const spanY = Math.max(0.2, bounds.maxY - bounds.minY);
  const midX = (bounds.minX + bounds.maxX) / 2;

  const compose = (textR: number) => {
    const r = Math.max(arc + 6, textR - outward);
    const cx = edge + availW / 2 - midX * textR;
    let cy = edge + bounds.maxY * textR;
    const innerHole = Math.max(8, r - arc);
    const text = readingText(ctx, ctx.value);
    let verticalCap = readingGuess;
    if (reading === "center") {
      verticalCap = Math.max(8, Math.min(readingGuess, Math.round(innerHole * 0.72)));
    } else if (reading === "gap") {
      const rim = bowlDepth(shape) * innerHole;
      const room = Math.max(8, rim - 2);
      verticalCap = Math.min(readingGuess, Math.max(8, Math.round(room)));
    }
    const tileHalf = Math.max(4, Math.min(cx - edge, w - edge - cx));
    const hole = holeRadius(r, arc, Boolean(shape.inner));
    const detailFor = (font: number) => {
      if (reading === "center") return 0;
      if (reading === "gap") {
        const rim = bowlDepth(shape) * innerHole;
        const half = font / 2;
        const preferred = r * 0.5;
        const limit = Math.max(half, rim - half - 2);
        return Math.round(Math.min(preferred, limit));
      }
      return Math.round(textR + gap + font / 2);
    };
    const fits = (font: number) => {
      const at = detailFor(font);
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
    const arcTop = cy - bounds.maxY * textR;
    const arcBottom = cy - bounds.minY * textR;
    const readTop = cy + detailY - readingFont / 2;
    const readBottom = cy + detailY + readingFont / 2;
    const top = Math.min(arcTop, readTop);
    const bottom = Math.max(arcBottom, readBottom);
    return { cx, cy, r, readingFont, detailY, top, bottom };
  };

  let textR = Math.max(8, Math.min(availW / spanX, availH / spanY));
  let laid = compose(textR);
  const roomH = Math.max(8, h - edge * 2);
  const overflows = laid.bottom - laid.top > roomH + 1;
  if (overflows) {
    const used = Math.max(1, laid.bottom - laid.top);
    textR = Math.max(8, textR * (roomH / used));
    laid = compose(textR);
  }
  // A shallow cap does not reach halfway down its own circle. Fastening it to
  // the top of the tile leaves the spare room underneath the arc. Centre it.
  const lowest = (laid.bottom - laid.cy) / Math.max(1, laid.r);
  if (overflows || lowest < 0.5) {
    const contentH = laid.bottom - laid.top;
    const shift = edge + (roomH - contentH) / 2 - laid.top;
    laid = { ...laid, cy: laid.cy + shift, top: laid.top + shift, bottom: laid.bottom + shift };
  }

  // How many numbers fit round the arc at this size: every n-th one is shown.
  const sweepDeg = Math.abs(signedSweep(shape.start, shape.end, clockwise)) || 360;
  const labelR = Math.max(8, laid.r - tick - labelW / 2);
  const spacing = (labelR * ((sweepDeg * Math.PI) / 180)) / Math.max(1, splits);
  const needed = Math.max(labelW, labelFont) + labelFont * 0.6;
  const labelEvery = shape.labels ? Math.max(1, Math.ceil(needed / Math.max(1, spacing))) : 1;

  const splitDistance = -(tick + 1 + arc);
  const labelDistance = -(tick + outward) - splitDistance;

  return {
    cx: Math.round(laid.cx),
    cy: Math.round(laid.cy),
    r: Math.round(laid.r),
    arc,
    tick,
    labelFont,
    labelEvery,
    readingFont: laid.readingFont,
    splitDistance,
    labelDistance,
    detail: [0, laid.detailY],
    hideMin: closesFullCircle(shape) && shape.labels,
  };
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
  const showScale = !inner && (shape.labels || shape.ticks);
  return {
    type: "gauge",
    min: ctx.min,
    max: ctx.max,
    splitNumber: marksForRange(ctx.min, ctx.max),
    center: [laid.cx, laid.cy],
    radius,
    startAngle: shape.start,
    endAngle: shape.end,
    clockwise: shape.clockwise !== false,
    pointer: {
      show: shape.pointer && !inner,
      length: "62%",
      width: Math.max(2, Math.round(laid.arc * 0.35)),
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
    axisTick: {
      show: showScale && shape.ticks,
      distance: laid.splitDistance,
      length: laid.tick,
      splitNumber: shape.minor ?? 4,
      lineStyle: { color: ink.muted, width: 1 },
    },
    splitLine: {
      show: showScale && shape.ticks,
      distance: laid.splitDistance,
      length: laid.tick,
      lineStyle: { color: ink.muted, width: 2 },
    },
    axisLabel: {
      show: showScale && shape.labels,
      distance: laid.labelDistance,
      color: ink.muted,
      fontSize: laid.labelFont,
      formatter: (v: number) => {
        if (laid.hideMin && Math.abs(v - ctx.min) <= Math.abs(ctx.max - ctx.min) * 1e-4 + 1e-4) return "";
        if (laid.labelEvery > 1) {
          const splits = marksForRange(ctx.min, ctx.max);
          const i = Math.round(((v - ctx.min) / (ctx.max - ctx.min || 1)) * splits);
          if (i % laid.labelEvery !== 0 && i !== splits) return "";
        }
        return tickText(v);
      },
    },
    anchor:
      shape.pointer && !inner
        ? { show: true, size: Math.max(6, laid.arc), itemStyle: { color: ink.text } }
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
        series,
      };
    },
  };
}

export const GAUGE_PRESETS: EchartsPreset[] = SHAPES.map(buildGauge);
