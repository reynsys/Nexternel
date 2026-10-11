/** Animated background effects (Settings → Appearance). The drawing code is in engine.ts, loaded only when one is on. */

export type BackgroundEffectId =
  | "off"
  | "snow"
  | "rain"
  | "stars"
  | "fireflies"
  | "bubbles"
  | "bokeh"
  | "network"
  | "network-follow"
  | "aurora"
  | "waves";

export type EffectColour = "white" | "accent" | "scene";

export const BACKGROUND_EFFECTS: { id: BackgroundEffectId; label: string; description: string }[] = [
  { id: "off", label: "Off", description: "Still background" },
  { id: "snow", label: "Snow", description: "Gentle falling flakes" },
  { id: "rain", label: "Rain", description: "Light drizzle" },
  { id: "stars", label: "Stars", description: "Twinkling night sky" },
  { id: "fireflies", label: "Fireflies", description: "Drifting glowing lights" },
  { id: "bubbles", label: "Bubbles", description: "Rising soap bubbles" },
  { id: "bokeh", label: "Bokeh", description: "Soft out-of-focus lights" },
  { id: "network", label: "Network", description: "Connected dots" },
  { id: "network-follow", label: "Network (follows you)", description: "Reacts to the pointer" },
  { id: "aurora", label: "Aurora", description: "Slow northern lights" },
  { id: "waves", label: "Waves", description: "Calm flowing lines" },
];

export const EFFECT_AMOUNTS = [
  { value: 0.5, label: "Few" },
  { value: 1, label: "Normal" },
  { value: 1.8, label: "Many" },
] as const;

export const EFFECT_SPEEDS = [
  { value: 0.5, label: "Slow" },
  { value: 1, label: "Normal" },
  { value: 1.7, label: "Fast" },
] as const;

export const EFFECT_COLOURS: { value: EffectColour; label: string }[] = [
  { value: "white", label: "White" },
  { value: "accent", label: "Accent" },
  { value: "scene", label: "Background" },
];

const IDS = new Set<string>(BACKGROUND_EFFECTS.map((e) => e.id));

export function normalizeEffectId(raw: unknown): BackgroundEffectId {
  return typeof raw === "string" && IDS.has(raw) ? (raw as BackgroundEffectId) : "off";
}

function nearest(raw: unknown, options: readonly { value: number }[]): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 1;
  return options.reduce((best, o) => (Math.abs(o.value - n) < Math.abs(best - n) ? o.value : best), 1);
}

export const normalizeEffectAmount = (raw: unknown) => nearest(raw, EFFECT_AMOUNTS);
export const normalizeEffectSpeed = (raw: unknown) => nearest(raw, EFFECT_SPEEDS);
export function normalizeEffectColour(raw: unknown): EffectColour {
  return raw === "accent" || raw === "scene" ? raw : "white";
}
