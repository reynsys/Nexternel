/**
 * One rule for the numbers along a scale (gauge dials and chart axes).
 *
 * - Large power and energy numbers are shown in the next unit up (2000 W → 2 kW),
 *   so the numbers stay short. The reading itself keeps its own unit.
 * - Numbers sit on tidy steps (1, 2, 2.5 or 5 times a power of ten), counted from zero,
 *   so they are always evenly spaced and never skip unevenly.
 */

/** Units that read better one step up once the numbers reach a thousand. */
const NEXT_UNIT_UP: Record<string, string> = {
  W: "kW",
  Wh: "kWh",
  kW: "MW",
  kWh: "MWh",
  VA: "kVA",
  var: "kvar",
  VAr: "kVAr",
};

export type ScaleUnit = {
  /** Divide a value by this before writing it on the scale. */
  factor: number;
  /** The unit the scale's numbers are in. */
  unit: string;
};

/** The unit a scale's numbers are written in, given the largest number on it. */
export function scaleUnit(unit: string, largest: number): ScaleUnit {
  const up = NEXT_UNIT_UP[unit.trim()];
  if (up && Math.abs(largest) >= 1000) return { factor: 1000, unit: up };
  return { factor: 1, unit };
}

const MANTISSAS = [1, 2, 2.5, 5];

/** Tidy steps from smallest to largest that suit a span (in scale units). */
export function tidySteps(span: number): number[] {
  const s = Math.abs(span);
  if (!(s > 0) || !Number.isFinite(s)) return [1];
  const steps: number[] = [];
  // From a step giving ~100 marks up to one covering the whole span.
  let exp = Math.floor(Math.log10(s / 100));
  while (steps.length === 0 || steps[steps.length - 1] < s) {
    for (const m of MANTISSAS) steps.push(roundStep(m * 10 ** exp));
    exp += 1;
  }
  return steps;
}

function roundStep(v: number): number {
  return Number(v.toPrecision(6));
}

/** Multiples of `step` between `min` and `max` (both in scale units), inclusive. */
export function stepValues(min: number, max: number, step: number): number[] {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const eps = step * 1e-6;
  const out: number[] = [];
  for (let k = Math.ceil((lo - eps) / step); k * step <= hi + eps; k++) {
    out.push(roundStep(k * step));
    if (out.length > 1000) break;
  }
  return out;
}

/** Decimals a step needs (2.5 → 1, 0.25 → 2, 5 → 0). */
export function stepDecimals(step: number): number {
  for (let d = 0; d <= 6; d++) {
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  }
  return 6;
}

/** A scale number with only the decimals it needs (1, 1.5, 2 — not 1.0, 1.5, 2.0). */
export function scaleText(v: number, step: number): string {
  const d = stepDecimals(step);
  let text = v.toFixed(d);
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  return text === "-0" ? "0" : text;
}
