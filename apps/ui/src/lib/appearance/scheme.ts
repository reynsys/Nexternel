import { contrast, hexToOklch, lightnessForContrast, mix, oklchToHex, withAlpha } from "./color";
import { buildNeutralScale, buildScale, harmonyColours, inkOn, type Harmony, type Mode, type Scale } from "./scale";

/**
 * The Appearance engine: from a few choices (mode, how see-through surfaces are, a main colour and
 * a second and third colour) it builds every colour Nexternel uses, by role, and checks that every
 * text and control is readable on what is behind it.
 *
 * Three layers (as in Material Design, Radix, Adobe Leonardo, and design-token systems):
 *   scales (twelve shades of each colour) → roles (what a colour is for) → parts of the screen.
 * Parts of the screen only ever use roles.
 */

export type SurfaceStyle = "solid" | "glass";

export type SchemeInput = {
  mode: Mode;
  /** Solid surfaces, or see-through (frosted) over the page background. */
  surfaces: SurfaceStyle;
  main: string;
  harmony: Harmony;
  /** Used when harmony is "custom". */
  second?: string;
  third?: string;
  status?: { ok?: string; watch?: string; alert?: string };
  /**
   * Colours the page background shows (a plain colour, or the colours of a gradient or glow).
   * See-through surfaces are checked for readability over each of them.
   */
  backgroundColours?: string[];
};

/** One colour family's roles. */
export type ColourRoles = {
  /** Solid fill: main buttons, the chosen tab, a switched-on switch. */
  solid: string;
  solidHover: string;
  /** Text and icons on the solid fill. */
  ink: string;
  /** Soft fill: chosen menu item, hovered outlined button, chips. */
  soft: string;
  softHover: string;
  /** Edge of controls in this colour (outlined buttons). */
  edge: string;
  /** Text and icons in this colour on any surface (readable). */
  text: string;
};

export type Roles = {
  mode: Mode;
  surfaces: SurfaceStyle;
  /** What fills each level, as CSS (see-through for glass). */
  surface: { background: string; frame: string; panel: string; popup: string; control: string; controlHover: string; controlActive: string };
  /** The same levels as solid colours (what text is actually read against). */
  surfaceSolid: { background: string; frame: string; panel: string; popup: string };
  text: { main: string; quiet: string };
  line: { edge: string; divider: string; control: string; focus: string };
  main: ColourRoles;
  second: ColourRoles;
  third: ColourRoles;
  /** Big values (temperatures, clock, energy): the second colour, the same in every panel. */
  value: string;
  status: { ok: ColourRoles; watch: ColourRoles; alert: ColourRoles };
  /** Colours for series in charts, in order. */
  series: string[];
};

export type AuditLine = { what: string; fg: string; bg: string; ratio: number; need: number; pass: boolean };

export type Scheme = {
  input: SchemeInput;
  scales: { neutral: Scale; main: Scale; second: Scale; third: Scale; ok: Scale; watch: Scale; alert: Scale };
  roles: Roles;
  /** Every pairing checked for readability (WCAG 2 contrast). */
  audit: AuditLine[];
};

const DEFAULT_STATUS = { ok: "#2FBF71", watch: "#F0A12F", alert: "#EF4D4D" };

/** How see-through each level is for glass, over the page background (made less see-through when needed). */
const GLASS_ALPHA = { frame: 0.62, panel: 0.7, popup: 0.86 };
type GlassAlpha = typeof GLASS_ALPHA;

function roles(scale: Scale): ColourRoles {
  return { solid: scale[8], solidHover: scale[9], ink: inkOn(scale[8]), soft: scale[2], softHover: scale[3], edge: scale[6], text: scale[10] };
}

/** Moves `fg` (same hue and colourfulness) just enough to read at `need` on every one of `bgs`. */
function readableOn(fg: string, bgs: string[], need: number, mode: Mode): string {
  let c = hexToOklch(fg);
  for (const bg of bgs) c = { ...c, l: lightnessForContrast(c, bg, need, mode === "light" ? "darker" : "lighter") };
  return oklchToHex(c);
}

/**
 * Builds the scheme. See-through surfaces start as see-through as they are meant to be and become a
 * little more solid, step by step, until every text is readable over every background colour.
 */
export function buildScheme(input: SchemeInput): Scheme {
  if (input.surfaces !== "glass") return buildWith(input, GLASS_ALPHA);
  let alpha = GLASS_ALPHA;
  let s = buildWith(input, alpha);
  for (let i = 0; i < 8 && s.audit.some((a) => !a.pass); i++) {
    const up = (v: number) => Math.min(0.97, v + 0.06);
    alpha = { frame: up(alpha.frame), panel: up(alpha.panel), popup: up(alpha.popup) };
    s = buildWith(input, alpha);
  }
  return s;
}

function buildWith(input: SchemeInput, GLASS: GlassAlpha): Scheme {
  const { mode } = input;
  const [suggest2, suggest3] = input.harmony === "custom" ? [input.second ?? input.main, input.third ?? input.main] : harmonyColours(input.main, input.harmony);
  const second = input.harmony === "custom" ? input.second ?? suggest2 : suggest2;
  const third = input.harmony === "custom" ? input.third ?? suggest3 : suggest3;
  const st = { ...DEFAULT_STATUS, ...input.status };

  const scales = {
    neutral: buildNeutralScale(input.main, mode),
    main: buildScale(input.main, mode),
    second: buildScale(second, mode),
    third: buildScale(third, mode),
    ok: buildScale(st.ok, mode),
    watch: buildScale(st.watch, mode),
    alert: buildScale(st.alert, mode),
  };
  const n = scales.neutral;

  // Levels: on light pages the page is a soft grey and boxes are near white; on dark pages boxes
  // are a step lighter than the page.
  const solidLevels =
    mode === "light"
      ? { background: n[1], frame: n[0], panel: n[0], popup: n[0] }
      : { background: n[0], frame: n[1], panel: n[1], popup: n[2] };

  // What text is read against: the solid level, or for glass that level seen over each background colour.
  const backdrops = input.surfaces === "glass" ? (input.backgroundColours?.length ? input.backgroundColours : [solidLevels.background]) : [];
  const seenAs = (level: keyof GlassAlpha): string[] =>
    input.surfaces === "glass" ? backdrops.map((bg) => mix(solidLevels[level], bg, GLASS[level])) : [solidLevels[level]];
  const readSurfaces = [solidLevels.background, ...seenAs("frame"), ...seenAs("panel"), ...seenAs("popup"), n[2], n[3]];

  const surface =
    input.surfaces === "glass"
      ? {
          background: solidLevels.background,
          frame: withAlpha(solidLevels.frame, GLASS.frame),
          panel: withAlpha(solidLevels.panel, GLASS.panel),
          popup: withAlpha(solidLevels.popup, GLASS.popup),
          control: withAlpha(n[2], 0.7),
          controlHover: withAlpha(n[3], 0.75),
          controlActive: withAlpha(n[4], 0.8),
        }
      : { ...solidLevels, control: n[2], controlHover: n[3], controlActive: n[4] };

  // Text roles are checked against every surface they can sit on, and moved if needed.
  const fix = (r: ColourRoles): ColourRoles => ({ ...r, text: readableOn(r.text, readSurfaces, 4.5, mode) });
  const main = fix(roles(scales.main));
  const sec = fix(roles(scales.second));
  const thr = fix(roles(scales.third));
  const status = { ok: fix(roles(scales.ok)), watch: fix(roles(scales.watch)), alert: fix(roles(scales.alert)) };
  const text = { main: readableOn(n[11], readSurfaces, 7, mode), quiet: readableOn(n[10], readSurfaces, 4.5, mode) };
  // Edges: box edges clearly seen (2:1 against the page), control edges 3:1 against what they sit on.
  const edge = readableOn(n[7], [solidLevels.background, ...seenAs("panel")], 2, mode);
  const controlEdge = readableOn(scales.main[7], readSurfaces.slice(0, -2), 3, mode);
  const line = { edge, divider: n[5], control: controlEdge, focus: scales.main[8] };

  const r: Roles = {
    mode,
    surfaces: input.surfaces,
    surface,
    surfaceSolid: solidLevels,
    text,
    line,
    main,
    second: sec,
    third: thr,
    value: sec.text,
    status,
    series: [main.solid, sec.solid, thr.solid, status.ok.solid, status.watch.solid, status.alert.solid],
  };

  const audit: AuditLine[] = [];
  const check = (what: string, fg: string, bgs: string[], need: number) => {
    for (const bg of bgs) {
      const ratio = contrast(fg, bg);
      audit.push({ what, fg, bg, ratio: Math.round(ratio * 100) / 100, need, pass: ratio >= need - 0.005 });
    }
  };
  const panelBgs = seenAs("panel");
  check("Main text on the page", r.text.main, [solidLevels.background], 7);
  check("Main text on a panel", r.text.main, panelBgs, 7);
  check("Main text on a frame", r.text.main, seenAs("frame"), 7);
  check("Main text on a pop-up", r.text.main, seenAs("popup"), 7);
  check("Quiet text on a panel", r.text.quiet, panelBgs, 4.5);
  check("Quiet text on a frame", r.text.quiet, seenAs("frame"), 4.5);
  check("Big values on a panel", r.value, panelBgs, 4.5);
  check("Main colour text on a panel", r.main.text, panelBgs, 4.5);
  check("Third colour text on a panel", r.third.text, panelBgs, 4.5);
  for (const k of ["main", "second", "third"] as const) check(`Text on a ${k} colour button`, r[k].ink, [r[k].solid], 4.5);
  for (const k of ["ok", "watch", "alert"] as const) check(`Status "${k}" text on a panel`, r.status[k].text, panelBgs, 4.5);
  check("Control edges on a panel", r.line.control, panelBgs, 3);
  check("Box edges on the page", r.line.edge, [solidLevels.background], 2);
  return { input: { ...input, second, third }, scales, roles: r, audit };
}
