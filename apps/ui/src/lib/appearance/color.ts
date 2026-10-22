/**
 * Colour maths for the Appearance engine.
 *
 * Colours are worked out in OKLCH (lightness 0–1, chroma, hue in degrees): a colour space where equal
 * steps look equal to the eye, so a scale of shades looks even whatever the hue. Readability is
 * measured with the WCAG 2 contrast ratio (1–21), the international standard for text on a background.
 */

export type Oklch = { l: number; c: number; h: number };
type Rgb = { r: number; g: number; b: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

export function hexToRgb(hex: string): Rgb {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}/i.test(h) || Number.isNaN(n)) throw new Error(`Not a colour: ${hex}`);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** Linear sRGB → OKLab (Björn Ottosson's matrices). */
function linearRgbToOklab(r: number, g: number, b: number) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToLinearRgb(L: number, a: number, b: number) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const lab = linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const c = Math.hypot(lab.a, lab.b);
  let h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab.L, c, h: c < 1e-4 ? 0 : h };
}

function oklchToLinear({ l, c, h }: Oklch) {
  const rad = (h * Math.PI) / 180;
  return oklabToLinearRgb(l, c * Math.cos(rad), c * Math.sin(rad));
}

const inGamut = (v: { r: number; g: number; b: number }) =>
  [v.r, v.g, v.b].every((x) => x >= -1e-4 && x <= 1 + 1e-4);

/**
 * OKLCH → hex. A colour the screen cannot show keeps its lightness and hue and loses just enough
 * chroma (colourfulness) to fit, so shades never jump in brightness.
 */
export function oklchToHex(color: Oklch): string {
  let lo = 0;
  let hi = color.c;
  let lin = oklchToLinear(color);
  if (!inGamut(lin)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinear({ ...color, c: lo });
  }
  return rgbToHex({ r: linearToSrgb(clamp01(lin.r)), g: linearToSrgb(clamp01(lin.g)), b: linearToSrgb(clamp01(lin.b)) });
}

/** WCAG 2 relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG 2 contrast ratio between two colours, 1 (none) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A colour seen through a see-through layer: `top` at `alpha` over `bottom` (both opaque hex). */
export function mix(top: string, bottom: string, alpha: number): string {
  const t = hexToRgb(top);
  const u = hexToRgb(bottom);
  return rgbToHex({ r: t.r * alpha + u.r * (1 - alpha), g: t.g * alpha + u.g * (1 - alpha), b: t.b * alpha + u.b * (1 - alpha) });
}

/** The same colour with see-through (CSS rgba). */
export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${Number(alpha.toFixed(3))})`;
}

/**
 * The lightness, between `from` and `to`, nearest to `from` at which the colour (same hue and chroma)
 * reaches `ratio` against `against`. Used to darken or lighten a colour just enough to be readable.
 */
export function lightnessForContrast(color: Oklch, against: string, ratio: number, towards: "lighter" | "darker"): number {
  const ok = (l: number) => contrast(oklchToHex({ ...color, l }), against) >= ratio;
  if (ok(color.l)) return color.l;
  const end = towards === "lighter" ? 1 : 0;
  if (!ok(end)) return end;
  let a = color.l;
  let b = end;
  for (let i = 0; i < 30; i++) {
    const mid = (a + b) / 2;
    if (ok(mid)) b = mid;
    else a = mid;
  }
  return b;
}
