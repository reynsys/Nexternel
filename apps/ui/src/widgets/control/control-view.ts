/** What a device control can do and what it last reported (see the API's devices/controls.ts). */
export type ControlFeatures = {
  min?: number;
  max?: number;
  step?: number;
  modes?: string[];
  fanSpeeds?: string[];
  presets?: string[];
  fixedPresets?: string[];
  brightness?: boolean;
  color?: boolean;
  white?: boolean;
  internet?: boolean;
};

export type ControlState = {
  on?: boolean;
  target?: number;
  current?: number;
  heating?: boolean;
  mode?: string;
  fan?: string;
  preset?: string;
  brightness?: number;
  color?: { h: number; s: number };
  white?: boolean;
  position?: number;
  speed?: number;
  humidity?: number;
  outside?: number;
};

const CONTROL_KINDS = new Set(["thermostat", "light", "climate", "cover", "fan"]);

export function isDeviceControlKind(kind: string): boolean {
  return CONTROL_KINDS.has(kind);
}

export function controlStateOf(value: unknown): ControlState {
  return typeof value === "object" && value !== null ? (value as ControlState) : {};
}

/** True while a setting such as Eco decides the temperature, so it cannot be changed from the panel. */
export function temperatureIsFixed(features: ControlFeatures, state: ControlState): boolean {
  return state.preset !== undefined && (features.fixedPresets ?? []).includes(state.preset);
}

/** The whole degrees and the half apart: the big number stays still when .5 comes and goes. */
export function splitTemperature(value: number): { whole: number; half: string } {
  const whole = Math.floor(value);
  const rest = Math.round((value - whole) * 10);
  return { whole, half: rest ? `.${rest}` : "" };
}

export function clampToStep(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(2))));
}

/** Point on the colour wheel (-1…1 from its centre) to a colour. */
export function colorFromPoint(x: number, y: number): { h: number; s: number } {
  const h = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
  return { h: Number(h.toFixed(1)), s: Number(Math.min(1, Math.hypot(x, y)).toFixed(3)) };
}

export function colorCss(c: { h: number; s: number }): string {
  return `hsl(${c.h} 100% ${Math.round(100 - c.s * 50)}%)`;
}

/** One line for the compact list view of a panel. */
export function controlSummary(kind: string, state: ControlState): string {
  if (state.on === false) return "Off";
  if (kind === "light") {
    if (state.brightness !== undefined) return `${state.brightness}%`;
    return state.on ? "On" : "—";
  }
  if (kind === "cover") return state.position ? `${state.position}%` : "Closed";
  if (kind === "fan") return fanWord(state.speed);
  if (kind === "climate" && state.mode === "fan") return "Fan";
  return state.target !== undefined ? `${state.target}°` : "—";
}

/** The word for a fan's speed; its buttons set the middle of each band. */
export const FAN_STEPS = [["Low", 25], ["Medium", 55], ["High", 100]] as const;
export function fanWord(speed: number | undefined): string {
  const v = speed ?? 0;
  return v < 40 ? "Low" : v < 75 ? "Medium" : "High";
}

/** Where a temperature sits on the dial, 0 at the lowest and 1 at the highest. */
export function dialShare(value: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
}

/** A point on the dial (from its centre) to a share; the gap at the bottom goes to the nearer end. */
export function shareFromPoint(x: number, y: number): number {
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const share = ((deg - 135 + 720) % 360) / 270;
  if (share <= 1) return share;
  return share > 7 / 6 ? 0 : 1;
}

/** True when the lamp is giving white, by its white lights or by a colour with none in it. */
export function isWhiteLight(state: ControlState): boolean {
  return state.white === true || (state.color !== undefined && state.color.s < 0.05);
}

/** The colour a panel takes: each air conditioning mode its own, otherwise one for the kind of device. */
export function deviceColour(kind: string, state: ControlState, features: ControlFeatures, main: string): string {
  if (kind === "climate") return MODE_COLOUR[state.mode ?? ""] ?? main;
  if (kind === "cover") return "#8fc1e3";
  if (kind === "fan") return "#5cc8ff";
  if (kind === "light") {
    if (!features.color) return WARM_LIGHT;
    if (isWhiteLight(state) || !state.color) return WHITE_LIGHT;
    return colorCss(state.color);
  }
  if (kind === "thermostat" && state.heating && state.on !== false) return HEATING_NOW;
  return main;
}

/** The colour of heating that is running right now, the same as air conditioning on heat. */
export const HEATING_NOW = "#ff7a3c";
export const WARM_LIGHT = "#ffc46b";
export const WHITE_LIGHT = "#fff4e6";
const MODE_COLOUR: Record<string, string> = { cool: "#5cc8ff", heat: HEATING_NOW, dry: "#4fd6b8", fan: "#d2d4d8" };
