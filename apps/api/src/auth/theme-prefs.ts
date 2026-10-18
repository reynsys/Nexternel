/** Shared normalize/parse for users.theme_prefs JSON. */

export type ThemePrefsDto = {
  mode: "light" | "dark";
  primary: string;
  skinId: string;
  /** The dashboard's Look (Standard, Glass or an installed Look pack). */
  lookId?: string;
  /** The Look's animations on (default) or off. */
  motion?: boolean;
  /** The chosen font of a Look that offers several (its id; the Look's first font when unset). */
  lookFont?: string;
  /** Size of all text in per cent (90, 100, 110 or 125). */
  textSize?: number;
  gradientId?: string;
  solidContentPanels?: boolean;
  effectId?: string;
  effectAmount?: number;
  effectSpeed?: number;
  effectColour?: "white" | "accent" | "scene";
  statusLight?: StatusLightPrefs;
  bell?: BellPrefs;
};

/** The notification bell for this person: when it shows and where (Settings → Appearance). */
export type BellPrefs = { show: "always" | "new" | "never"; position: "menu" | "top" };

function bellField(raw: unknown): BellPrefs {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return {
    show: o.show === "new" || o.show === "never" ? o.show : "always",
    position: o.position === "top" ? "top" : "menu",
  };
}

/** How status lights look for this person (each panel can still choose its own style). */
export type StatusLightPrefs = {
  style: "pill" | "bar" | "dots" | "glow" | "off";
  position: "title" | "reading";
  blink: boolean;
  colours: { ok: string; watch: string; alert: string };
};

const STATUS_LIGHT_DEFAULT: StatusLightPrefs = {
  style: "pill",
  position: "title",
  blink: true,
  colours: { ok: "#2fbf71", watch: "#f0a12f", alert: "#ef4d4d" },
};

function statusLightField(raw: unknown): StatusLightPrefs {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const c = (o.colours && typeof o.colours === "object" ? o.colours : {}) as Record<string, unknown>;
  const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
  const d = STATUS_LIGHT_DEFAULT;
  return {
    style: ["pill", "bar", "dots", "glow", "off"].includes(o.style as string) ? (o.style as StatusLightPrefs["style"]) : d.style,
    position: o.position === "reading" ? "reading" : "title",
    blink: typeof o.blink === "boolean" ? o.blink : d.blink,
    colours: { ok: hex(c.ok, d.colours.ok), watch: hex(c.watch, d.colours.watch), alert: hex(c.alert, d.colours.alert) },
  };
}

const DEFAULT: ThemePrefsDto = {
  mode: "dark",
  primary: "#1A73E8",
  skinId: "mui-dashboard",
  lookId: "standard",
  motion: true,
  textSize: 100,
  gradientId: "none",
  solidContentPanels: false,
  effectId: "off",
  effectAmount: 1,
  effectSpeed: 1,
  effectColour: "white",
  statusLight: STATUS_LIGHT_DEFAULT,
  bell: { show: "always", position: "menu" },
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Known gradient ids (keep in sync with UI gradientPalettes). */
const GRADIENT_IDS = new Set([
  "none",
  "watermelon-crush",
  "sedona-sunrise",
  "seascape",
  "blackcurrant",
  "cotton-candy",
  "carrot",
  "honeydew",
  "spotlight",
  "nectarine",
  "south-pacific",
  "raspberry-velvet",
  "pink-sands",
  "iguana",
  "stormy-skies",
  "jade-aubergine",
  "hot-and-cold",
  "emerald-isle",
  "cloudburst",
  "ocean-sunsets",
  "lavender-haze",
  "dust-bowl",
  "pink-clouds",
  "azure-mist",
  "touch-of-gray",
  "buckskin",
  "parakeet",
  "lupine-bloom",
  "amulet",
  "seashell",
  "blueberry-blitz",
  "lime-sherbet",
  "grayscale",
  "asphalt",
  // Soft glow backgrounds
  "glow-blue",
  "glow-black",
  "glow-amethyst",
  "glow-emerald",
  "glow-bronze",
  "glow-gold",
  "glow-aurora",
  "glow-sunset",
  "glow-ocean",
  "glow-rose",
  "glow-pearl",
  "glow-sky",
  "glow-mint",
  "glow-peach",
  "glow-lilac",
  "glow-lemon",
]);

/** Known background effects (keep in sync with UI skins/effects/catalog.ts). */
const EFFECT_IDS = new Set([
  "off",
  "snow",
  "rain",
  "stars",
  "fireflies",
  "bubbles",
  "bokeh",
  "network",
  "network-follow",
  "aurora",
  "waves",
]);

function pickNearest(raw: unknown, allowed: number[]): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 1;
  return allowed.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 1);
}

function effectFields(o: Record<string, unknown>) {
  return {
    effectId: typeof o.effectId === "string" && EFFECT_IDS.has(o.effectId) ? o.effectId : "off",
    effectAmount: pickNearest(o.effectAmount, [0.5, 1, 1.8]),
    effectSpeed: pickNearest(o.effectSpeed, [0.5, 1, 1.7]),
    effectColour: (o.effectColour === "accent" || o.effectColour === "scene" ? o.effectColour : "white") as
      | "white"
      | "accent"
      | "scene",
  };
}

export function defaultThemePrefs(): ThemePrefsDto {
  return { ...DEFAULT, statusLight: statusLightField(null), bell: bellField(null) };
}

/**
 * Look ids are short lowercase names. A Look not installed on this server is still kept (the UI
 * shows Standard instead). Prefs saved before Looks get one from the old panels setting:
 * frosted panels over a background were the Glass Look (same rule as the UI's look-choice.ts).
 */
function lookField(o: Record<string, unknown>): string {
  if (typeof o.lookId === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(o.lookId)) return o.lookId;
  const backdrop =
    normalizeGradientId(o.gradientId) !== "none" || (typeof o.effectId === "string" && EFFECT_IDS.has(o.effectId) && o.effectId !== "off");
  return backdrop && !o.solidContentPanels ? "glass" : "standard";
}

const TEXT_SIZES = new Set([90, 100, 110, 125]);
function textSizeField(o: Record<string, unknown>): number {
  return typeof o.textSize === "number" && TEXT_SIZES.has(o.textSize) ? o.textSize : 100;
}

function lookFontField(o: Record<string, unknown>): { lookFont?: string } {
  return typeof o.lookFont === "string" && /^[a-z0-9][a-z0-9-]{0,39}$/.test(o.lookFont) ? { lookFont: o.lookFont } : {};
}

function normalizeGradientId(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "none";
  const id = raw.trim();
  return GRADIENT_IDS.has(id) ? id : "none";
}

/** Accept unknown JSON from DB or request body; return normalized prefs or null if invalid body. */
export function parseThemePrefsInput(
  raw: unknown
): ThemePrefsDto | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const mode = o.mode === "light" ? "light" : o.mode === "dark" ? "dark" : null;
  const primary =
    typeof o.primary === "string" && HEX.test(o.primary) ? o.primary : null;
  const skinId =
    typeof o.skinId === "string" && o.skinId.trim()
      ? o.skinId.trim()
      : null;
  if (!mode || !primary || !skinId) return null;
  return {
    mode,
    primary,
    skinId,
    lookId: lookField(o),
    motion: o.motion !== false,
    ...lookFontField(o),
    textSize: textSizeField(o),
    gradientId: normalizeGradientId(o.gradientId),
    solidContentPanels: Boolean(o.solidContentPanels),
    ...effectFields(o),
    statusLight: statusLightField(o.statusLight),
    bell: bellField(o.bell),
  };
}

export function themePrefsFromDb(raw: unknown): ThemePrefsDto {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaultThemePrefs();
  }
  const o = raw as Record<string, unknown>;
  return {
    mode: o.mode === "light" ? "light" : "dark",
    primary:
      typeof o.primary === "string" && HEX.test(o.primary)
        ? o.primary
        : DEFAULT.primary,
    skinId:
      typeof o.skinId === "string" && o.skinId.trim()
        ? o.skinId.trim()
        : DEFAULT.skinId,
    lookId: lookField(o),
    motion: o.motion !== false,
    ...lookFontField(o),
    textSize: textSizeField(o),
    gradientId: normalizeGradientId(o.gradientId),
    solidContentPanels: Boolean(o.solidContentPanels),
    ...effectFields(o),
    statusLight: statusLightField(o.statusLight),
    bell: bellField(o.bell),
  };
}
