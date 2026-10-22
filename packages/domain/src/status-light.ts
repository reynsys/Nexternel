/**
 * Status lights: whether a reading is normal, worth keeping an eye on, or needs action now.
 * Limits belong to the reading (capability) so it shows the same colour on every dashboard,
 * and bell alerts use the same limits.
 */

export type StatusState = "ok" | "watch" | "alert" | "stale";

/** Any band can be left out: CO2 only has "too high" limits, temperature has both sides. */
export type StatusLimits = {
  alertLow?: number | null;
  watchLow?: number | null;
  watchHigh?: number | null;
  alertHigh?: number | null;
};

export type StatusLightSettings = {
  /** false = this reading never shows a light. */
  enabled: boolean;
  limits: StatusLimits;
  /** Send a bell notification when the reading stays at "act now" this many minutes; null = never. */
  notifyAfterMin: number | null;
};

export const DEFAULT_NOTIFY_AFTER_MIN = 10;

/** Starting limits per kind of reading (common indoor comfort and air quality guidance). */
export const DEFAULT_STATUS_LIMITS: Record<string, StatusLimits> = {
  temperature: { alertLow: 16, watchLow: 18, watchHigh: 24, alertHigh: 27 },
  humidity: { alertLow: 30, watchLow: 40, watchHigh: 60, alertHigh: 70 },
  co2: { watchHigh: 1000, alertHigh: 2000 },
  // PM1.0 has no official limit; these sit a little below PM2.5's (PM1.0 is part of PM2.5).
  pm1: { watchHigh: 10, alertHigh: 25 },
  pm25: { watchHigh: 12, alertHigh: 35 },
  pm10: { watchHigh: 45, alertHigh: 100 },
  battery: { alertLow: 15, watchLow: 30 },
};

/** Settings a reading starts with before anyone changes them (null = this kind has no light). */
export function defaultStatusSettings(kind: string): StatusLightSettings | null {
  const limits = DEFAULT_STATUS_LIMITS[kind];
  if (!limits) return null;
  return { enabled: true, limits: { ...limits }, notifyAfterMin: DEFAULT_NOTIFY_AFTER_MIN };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The state a value is in right now (no waiting time applied). */
export function statusOf(value: unknown, limits: StatusLimits): Exclude<StatusState, "stale"> | null {
  const v = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const aL = num(limits.alertLow);
  const aH = num(limits.alertHigh);
  const wL = num(limits.watchLow);
  const wH = num(limits.watchHigh);
  if ((aL !== null && v < aL) || (aH !== null && v > aH)) return "alert";
  if ((wL !== null && v < wL) || (wH !== null && v > wH)) return "watch";
  return "ok";
}

/** Check limits are in order (too-low below too-high); returns a plain-language problem or null. */
export function checkStatusLimits(l: StatusLimits): string | null {
  const order: [keyof StatusLimits, string][] = [
    ["alertLow", "Act now below"],
    ["watchLow", "Keep an eye on it below"],
    ["watchHigh", "Keep an eye on it above"],
    ["alertHigh", "Act now above"],
  ];
  let last: { v: number; label: string } | null = null;
  for (const [key, label] of order) {
    const v = num(l[key]);
    if (v === null) continue;
    if (last && v < last.v) return `"${label}" (${v}) must not be lower than "${last.label}" (${last.v}).`;
    last = { v, label };
  }
  return null;
}

/** "above 27 °C" / "below 16 °C": why a reading is in its state. */
export function statusReason(value: number, limits: StatusLimits, state: StatusState, unit?: string | null): string {
  const u = unit ? ` ${unit}` : "";
  if (state === "alert") {
    if (num(limits.alertLow) !== null && value < (limits.alertLow as number)) return `below ${limits.alertLow}${u}`;
    if (num(limits.alertHigh) !== null) return `above ${limits.alertHigh}${u}`;
  }
  if (state === "watch") {
    if (num(limits.watchLow) !== null && value < (limits.watchLow as number)) return `below ${limits.watchLow}${u}`;
    if (num(limits.watchHigh) !== null) return `above ${limits.watchHigh}${u}`;
  }
  return "within its normal range";
}

export const STATUS_WORDS: Record<StatusState, string> = {
  ok: "normal",
  watch: "keep an eye on it",
  alert: "act now",
  stale: "no recent reading",
};

/** How a panel shows its lights. "default" follows the person's Appearance settings. */
export type StatusLightStyle = "pill" | "bar" | "dots" | "glow" | "off";
export type StatusLightPosition = "title" | "reading";

export type StatusLightColours = { ok: string; watch: string; alert: string };

/**
 * A panel's status light, chosen in its Edit menu. "default" (and no colours) = the panel has not
 * chosen yet and shows the starting look.
 */
export type PanelStatusLight = {
  style: StatusLightStyle | "default";
  position: StatusLightPosition | "default";
  blink: boolean | "default";
  colours?: StatusLightColours;
};

export const STATUS_LIGHT_DEFAULTS = { style: "pill" as StatusLightStyle, position: "title" as StatusLightPosition, blink: true };

export function readPanelStatusLight(config: Record<string, unknown> | null | undefined): PanelStatusLight {
  const raw = (config?.statusLight ?? {}) as Partial<PanelStatusLight>;
  const styles = ["pill", "bar", "dots", "glow", "off", "default"];
  const positions = ["title", "reading", "default"];
  const c = (raw.colours && typeof raw.colours === "object" ? raw.colours : {}) as Record<string, unknown>;
  const hex = (v: unknown) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v);
  return {
    style: styles.includes(raw.style as string) ? (raw.style as PanelStatusLight["style"]) : "default",
    position: positions.includes(raw.position as string) ? (raw.position as PanelStatusLight["position"]) : "default",
    blink: typeof raw.blink === "boolean" ? raw.blink : "default",
    ...(hex(c.ok) && hex(c.watch) && hex(c.alert)
      ? { colours: { ok: c.ok as string, watch: c.watch as string, alert: c.alert as string } }
      : {}),
  };
}
