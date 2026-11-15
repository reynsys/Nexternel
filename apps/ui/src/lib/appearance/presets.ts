import type { Harmony } from "./scale";

/**
 * Ready-made themes: a starting point that sets style, colours, background and font together. Each
 * works in Light and Dark: picking one keeps the person's own Light / Dark / Auto choice.
 * Anything can be changed afterwards; the result is the person's own theme.
 */
export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  lookId: string;
  primary: string;
  harmony: Harmony;
  /** Second colour (big readings) and third (small touches), chosen by hand (harmony "custom"). */
  second?: string;
  third?: string;
  /** The colour backgrounds, boxes and lines are tinted with; left out, the main colour. */
  tint?: string;
  gradientId: string;
  font: string;
};

/*
 * Themes from the colour wheel (blue, purple, green, teal, orange, red, pink-purple, olive) and one
 * without colour (Mono).
 * Green, amber and red mean OK, Attention and Alarm everywhere, so:
 * - main colours that sit near them (Emerald, Ember, Ruby) are deeper shades, checked to stay apart;
 * - readings (second colour) come from the cool half of the wheel or pale tones, and each theme has
 *   its own, chosen together so no two themes' readings look alike (appearance.test.ts checks this);
 * - the third colour is a calmer neighbour of the main colour, for small touches.
 */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "nexternel", label: "Midnight Blue", description: "Clean blue on deep night.", lookId: "standard", primary: "#2F7BFF", harmony: "custom", second: "#E879F9", third: "#A38BE1", gradientId: "none", font: "inter" },
  { id: "aurora", label: "Aurora", description: "Purple for new ideas, behind frosted glass.", lookId: "glass", primary: "#8B5CF6", harmony: "custom", second: "#22D3EE", third: "#C57BC3", gradientId: "glow-aurora", font: "space-grotesk" },
  { id: "emerald", label: "Emerald", description: "Deep green, friendly letters.", lookId: "standard", primary: "#0F9D6B", harmony: "custom", second: "#60A5FA", third: "#5BADAE", gradientId: "none", font: "nunito" },
  { id: "ocean-glass", label: "Ocean", description: "Calm teal through glass.", lookId: "glass", primary: "#0EA5B7", harmony: "custom", second: "#818CF8", third: "#87B1D3", gradientId: "mine-glow", font: "manrope" },
  { id: "ember", label: "Ember", description: "Deep copper glow.", lookId: "standard", primary: "#B45309", harmony: "custom", second: "#C084FC", third: "#F9A8D4", gradientId: "mine-glow", font: "lexend" },
  { id: "ruby", label: "Ruby", description: "Rich raspberry red.", lookId: "standard", primary: "#C2185B", harmony: "custom", second: "#DDD6FE", third: "#AC67A5", gradientId: "mine-gradient", font: "poppins" },
  { id: "fuchsia", label: "Fuchsia", description: "Bold pink-purple through glass.", lookId: "glass", primary: "#C026D3", harmony: "custom", second: "#0EA5E9", third: "#9283EE", gradientId: "mine-glow", font: "exo-2" },
  { id: "moss", label: "Moss", description: "Deep olive green, calm and natural.", lookId: "standard", primary: "#4D7C0F", harmony: "custom", second: "#CCF5EE", third: "#4D9479", gradientId: "none", font: "roboto" },
  { id: "mono", label: "Mono", description: "Black, white and grey. No colour, nothing to distract.", lookId: "standard", primary: "#52525B", harmony: "custom", second: "#F4F4F5", third: "#A1A1AA", gradientId: "none", font: "ibm-plex-sans" },
];
