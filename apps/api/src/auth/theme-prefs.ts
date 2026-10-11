/** Shared normalize/parse for users.theme_prefs JSON. */

export type ThemePrefsDto = {
  mode: "light" | "dark";
  primary: string;
  skinId: string;
  gradientId?: string;
  solidContentPanels?: boolean;
  effectId?: string;
  effectAmount?: number;
  effectSpeed?: number;
  effectColour?: "white" | "accent" | "scene";
};

const DEFAULT: ThemePrefsDto = {
  mode: "dark",
  primary: "#1A73E8",
  skinId: "mui-dashboard",
  gradientId: "none",
  solidContentPanels: false,
  effectId: "off",
  effectAmount: 1,
  effectSpeed: 1,
  effectColour: "white",
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
  return { ...DEFAULT };
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
    gradientId: normalizeGradientId(o.gradientId),
    solidContentPanels: Boolean(o.solidContentPanels),
    ...effectFields(o),
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
    gradientId: normalizeGradientId(o.gradientId),
    solidContentPanels: Boolean(o.solidContentPanels),
    ...effectFields(o),
  };
}
