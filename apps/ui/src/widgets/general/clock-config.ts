export const CLOCK_FACES = ["digital", "analog"] as const;
export const CLOCK_DIALS = ["classic", "minimal", "roman"] as const;
export const CLOCK_COLORS = ["text", "accent"] as const;

export type ClockFace = (typeof CLOCK_FACES)[number];
export type ClockDial = (typeof CLOCK_DIALS)[number];
export type ClockColor = (typeof CLOCK_COLORS)[number];

export type ClockConfig = {
  face: ClockFace;
  dial: ClockDial;
  bold: boolean;
  italic: boolean;
  color: ClockColor;
};

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Saved clock choices. Missing fields keep a digital clock. The clock always uses the dashboard font. */
export function parseClockConfig(config: Record<string, unknown> | undefined): ClockConfig {
  const legacyFace = config?.faceStyle === "analog" || config?.timeMode === "analog" ? "analog" : "digital";
  const legacyDial = oneOf(config?.analogClockStyle, CLOCK_DIALS, "classic");
  return {
    face: oneOf(config?.clockFace, CLOCK_FACES, legacyFace),
    dial: oneOf(config?.clockDial, CLOCK_DIALS, legacyDial),
    bold: config?.clockBold === false ? false : true,
    italic: config?.clockItalic === true,
    color: oneOf(config?.clockColor, CLOCK_COLORS, "text"),
  };
}
