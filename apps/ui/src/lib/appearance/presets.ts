import type { Harmony } from "./scale";

/**
 * Ready-made themes: a starting point that sets style, mode, colours, background and font together.
 * Anything can be changed afterwards; the result is the person's own theme.
 */
export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  lookId: string;
  mode: "light" | "dark";
  primary: string;
  harmony: Harmony;
  /** Second and third colours chosen by hand for this theme (with harmony "custom"). */
  second?: string;
  third?: string;
  gradientId: string;
  font: string;
};

/*
 * The six dark themes have clearly different main colours (blue, orange-red, teal, purple, green,
 * amber) and hand-picked second and third colours, so no two share a set: worked out from the
 * main colour alone, the blue ones all came out with the same orange and teal.
 */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "nexternel", label: "Midnight Blue", description: "Clean blue on deep night.", lookId: "standard", mode: "dark", primary: "#2F7BFF", harmony: "custom", second: "#FFB020", third: "#2DD4BF", gradientId: "none", font: "inter" },
  { id: "ember", label: "Ember", description: "Warm orange glow.", lookId: "standard", mode: "dark", primary: "#F4511E", harmony: "custom", second: "#FFC83D", third: "#C084FC", gradientId: "mine-glow", font: "inter" },
  { id: "ocean-glass", label: "Ocean Glass", description: "See-through panels over calm sea colours.", lookId: "glass", mode: "dark", primary: "#12B8C8", harmony: "custom", second: "#5B8CFF", third: "#7CE0B8", gradientId: "mine-glow", font: "manrope" },
  { id: "aurora", label: "Aurora", description: "Northern lights behind frosted glass.", lookId: "glass", mode: "dark", primary: "#A855F7", harmony: "custom", second: "#34E3A0", third: "#F472B6", gradientId: "glow-aurora", font: "space-grotesk" },
  { id: "forest", label: "Forest", description: "Calm greens, friendly letters.", lookId: "standard", mode: "dark", primary: "#3FB950", harmony: "custom", second: "#E3B341", third: "#6FB7FF", gradientId: "none", font: "nunito" },
  { id: "control-room", label: "Control Room", description: "Technical lettering, amber like a control desk.", lookId: "standard", mode: "dark", primary: "#FFB000", harmony: "custom", second: "#38BDF8", third: "#A3E635", gradientId: "mine-gradient", font: "rajdhani" },
  { id: "paper", label: "Paper", description: "Light and quiet, for daytime.", lookId: "standard", mode: "light", primary: "#344767", harmony: "split", gradientId: "none", font: "ibm-plex-sans" },
  { id: "rose-glass", label: "Rose Glass", description: "Soft pinks through light glass.", lookId: "glass", mode: "light", primary: "#D81B60", harmony: "analogous", gradientId: "mine-glow", font: "poppins" },
  { id: "sunrise", label: "Sunrise", description: "Bright and easy to read.", lookId: "standard", mode: "light", primary: "#FB8C00", harmony: "complementary", gradientId: "mine-gradient", font: "lexend" },
];
