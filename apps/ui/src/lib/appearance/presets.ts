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
  gradientId: string;
  font: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  { id: "nexternel", label: "Nexternel", description: "Clean blue on deep night.", lookId: "standard", mode: "dark", primary: "#1A73E8", harmony: "split", gradientId: "none", font: "inter" },
  { id: "ember", label: "Ember", description: "Warm orange glow.", lookId: "standard", mode: "dark", primary: "#F4511E", harmony: "split", gradientId: "mine-glow", font: "inter" },
  { id: "ocean-glass", label: "Ocean Glass", description: "See-through panels over calm blues.", lookId: "glass", mode: "dark", primary: "#0288D1", harmony: "analogous", gradientId: "mine-glow", font: "manrope" },
  { id: "aurora", label: "Aurora", description: "Northern lights behind frosted glass.", lookId: "glass", mode: "dark", primary: "#7E57C2", harmony: "triadic", gradientId: "glow-aurora", font: "space-grotesk" },
  { id: "forest", label: "Forest", description: "Calm greens, friendly letters.", lookId: "standard", mode: "dark", primary: "#2E7D32", harmony: "analogous", gradientId: "none", font: "nunito" },
  { id: "control-room", label: "Control Room", description: "Technical lettering, cool contrast.", lookId: "standard", mode: "dark", primary: "#00ACC1", harmony: "complementary", gradientId: "mine-gradient", font: "rajdhani" },
  { id: "paper", label: "Paper", description: "Light and quiet, for daytime.", lookId: "standard", mode: "light", primary: "#344767", harmony: "split", gradientId: "none", font: "ibm-plex-sans" },
  { id: "rose-glass", label: "Rose Glass", description: "Soft pinks through light glass.", lookId: "glass", mode: "light", primary: "#D81B60", harmony: "analogous", gradientId: "mine-glow", font: "poppins" },
  { id: "sunrise", label: "Sunrise", description: "Bright and easy to read.", lookId: "standard", mode: "light", primary: "#FB8C00", harmony: "complementary", gradientId: "mine-gradient", font: "lexend" },
];
