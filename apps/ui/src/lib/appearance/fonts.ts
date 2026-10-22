/**
 * The fonts every style can use. All are open-licence (SIL OFL) and built into Nexternel, so they look
 * the same on every screen and work offline (lib/appearance/fonts-load.ts declares them; a browser
 * only downloads a font once it is chosen).
 */
export type FontGroup = "clear" | "friendly" | "reading" | "tech";

export type CoreFont = {
  id: string;
  label: string;
  /** CSS font-family, with fallbacks. */
  family: string;
  group: FontGroup;
  description: string;
  /**
   * Wide or narrow fonts are scaled so text takes about the same room as the default font
   * (1 = as is). Applied to the page's text size.
   */
  scale: number;
};

const fallback = `"Segoe UI", Roboto, Helvetica, Arial, sans-serif`;

export const FONT_GROUPS: { id: FontGroup; label: string }[] = [
  { id: "clear", label: "Clear" },
  { id: "friendly", label: "Friendly" },
  { id: "reading", label: "Easy reading" },
  { id: "tech", label: "Technical & sci-fi" },
];

export const CORE_FONTS: CoreFont[] = [
  { id: "inter", label: "Inter", family: `"Inter Variable", ${fallback}`, group: "clear", description: "Crisp and neutral; made for screens.", scale: 1 },
  { id: "roboto", label: "Roboto", family: `"Roboto Variable", ${fallback}`, group: "clear", description: "Familiar from Android; plain and even.", scale: 1 },
  { id: "ibm-plex-sans", label: "IBM Plex Sans", family: `"IBM Plex Sans", ${fallback}`, group: "clear", description: "Engineered look with friendly details.", scale: 1 },
  { id: "manrope", label: "Manrope", family: `"Manrope Variable", ${fallback}`, group: "clear", description: "Modern and open.", scale: 1 },
  { id: "space-grotesk", label: "Space Grotesk", family: `"Space Grotesk Variable", ${fallback}`, group: "clear", description: "Modern with a hint of character.", scale: 1 },
  { id: "nunito", label: "Nunito", family: `"Nunito Variable", ${fallback}`, group: "friendly", description: "Rounded and warm.", scale: 1.02 },
  { id: "poppins", label: "Poppins", family: `"Poppins", ${fallback}`, group: "friendly", description: "Round, geometric shapes.", scale: 0.95 },
  { id: "lexend", label: "Lexend", family: `"Lexend Variable", ${fallback}`, group: "reading", description: "Designed to be read quickly and easily.", scale: 0.96 },
  { id: "atkinson-hyperlegible", label: "Atkinson Hyperlegible", family: `"Atkinson Hyperlegible", ${fallback}`, group: "reading", description: "Letters that cannot be mistaken; made for low vision.", scale: 1.02 },
  { id: "jetbrains-mono", label: "JetBrains Mono", family: `"JetBrains Mono Variable", ui-monospace, monospace`, group: "tech", description: "Every letter the same width.", scale: 0.9 },
  { id: "rajdhani", label: "Rajdhani", family: `"Rajdhani", ${fallback}`, group: "tech", description: "Narrow and technical.", scale: 1.12 },
  { id: "exo-2", label: "Exo 2", family: `"Exo 2 Variable", ${fallback}`, group: "tech", description: "Futuristic but easy to read.", scale: 1 },
  { id: "electrolize", label: "Electrolize", family: `"Electrolize", ${fallback}`, group: "tech", description: "Instrument-panel lettering.", scale: 1.04 },
  { id: "aldrich", label: "Aldrich", family: `"Aldrich", ${fallback}`, group: "tech", description: "Square sci-fi letters.", scale: 0.97 },
  { id: "orbitron", label: "Orbitron", family: `"Orbitron Variable", ${fallback}`, group: "tech", description: "Wide, space-age letters.", scale: 0.86 },
  { id: "michroma", label: "Michroma", family: `"Michroma", ${fallback}`, group: "tech", description: "Very wide, technical.", scale: 0.8 },
  { id: "audiowide", label: "Audiowide", family: `"Audiowide", ${fallback}`, group: "tech", description: "Bold sci-fi display letters.", scale: 0.92 },
];

export const DEFAULT_FONT_ID = "inter";

export function coreFont(id: string | null | undefined): CoreFont | undefined {
  return CORE_FONTS.find((f) => f.id === id);
}
