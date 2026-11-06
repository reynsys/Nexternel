/**
 * Device controls: things that do more than on and off (heating, a dimmable or colour light, air
 * conditioning, blinds, a fan). A device says what it can do (its features); Nexternel draws only those controls and
 * sends only values the device accepts. The white button, for example, shows only when the device
 * says it has white lights.
 *
 * Pure rules, no database: see control-commands.ts for sending.
 */
export const CONTROL_TYPES = ["thermostat", "light", "climate", "cover", "fan"] as const;
export type ControlType = (typeof CONTROL_TYPES)[number];

export const CLIMATE_MODES = ["auto", "cool", "heat", "dry", "fan"] as const;
export const FAN_SPEEDS = ["auto", "low", "medium", "high"] as const;

export type ControlFeatures = {
  /** Set temperature range. */
  min?: number;
  max?: number;
  step?: number;
  /** Air conditioning: the modes and fan speeds this unit has. */
  modes?: string[];
  fanSpeeds?: string[];
  /** Heating: named settings such as Comfort, Eco and Away. */
  presets?: string[];
  /** Heating: settings whose temperature the device decides, so it cannot be changed from here. */
  fixedPresets?: string[];
  /** Light: what this light can do. */
  brightness?: boolean;
  color?: boolean;
  white?: boolean;
  /** Reached through the maker's internet service, so it stops answering without the internet. */
  internet?: boolean;
};

export type ControlColor = { h: number; s: number };

/** What a device reports: only the parts it has. */
export type ControlState = {
  on?: boolean;
  target?: number;
  current?: number;
  heating?: boolean;
  mode?: string;
  fan?: string;
  preset?: string;
  brightness?: number;
  color?: ControlColor;
  white?: boolean;
  /** Blinds: 0 is closed, 100 is fully open. */
  position?: number;
  /** Fan: 1 to 100. */
  speed?: number;
  /** Extra readings a heating device can report. */
  humidity?: number;
  outside?: number;
};

export function isControlType(v: unknown): v is ControlType {
  return typeof v === "string" && (CONTROL_TYPES as readonly string[]).includes(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function oneOf(raw: unknown, allowed: readonly string[], fallback: readonly string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const list = allowed.filter((a) => raw.includes(a));
  return list.length ? list : [...fallback];
}

/** What a device declared, kept to what Nexternel understands, with sensible ranges. */
export function parseControlFeatures(type: ControlType, raw: unknown): ControlFeatures {
  const features = parseTypeFeatures(type, raw);
  return isRecord(raw) && raw.internet === true ? { ...features, internet: true } : features;
}

function parseTypeFeatures(type: ControlType, raw: unknown): ControlFeatures {
  const f = isRecord(raw) ? raw : {};
  if (type === "light") {
    return { brightness: f.brightness === true, color: f.color === true, white: f.white === true };
  }
  if (type === "cover" || type === "fan") return {};
  const heating = type === "thermostat";
  const min = finite(f.min) ?? (heating ? 10 : 16);
  const max = finite(f.max) ?? 30;
  const step = finite(f.step);
  const range = {
    min: Math.min(min, max),
    max: Math.max(min, max),
    step: step && step > 0 ? step : heating ? 0.5 : 1,
  };
  if (heating) {
    const presets = Array.isArray(f.presets) ? f.presets.filter((p): p is string => typeof p === "string" && p.trim() !== "").slice(0, 4) : [];
    if (!presets.length) return range;
    const fixed = Array.isArray(f.fixedPresets) ? presets.filter((p) => (f.fixedPresets as unknown[]).includes(p)) : [];
    return fixed.length ? { ...range, presets, fixedPresets: fixed } : { ...range, presets };
  }
  return { ...range, modes: oneOf(f.modes, CLIMATE_MODES, CLIMATE_MODES), fanSpeeds: oneOf(f.fanSpeeds, FAN_SPEEDS, FAN_SPEEDS) };
}

function snapTemperature(v: number, f: ControlFeatures): number {
  const step = f.step ?? 1;
  const min = f.min ?? v;
  const snapped = min + Math.round((v - min) / step) * step;
  return Math.min(f.max ?? snapped, Math.max(min, Number(snapped.toFixed(2))));
}

function cleanColor(raw: unknown): ControlColor | null {
  if (!isRecord(raw)) return null;
  const h = finite(raw.h);
  const s = finite(raw.s);
  if (h === null || s === null) return null;
  return { h: ((h % 360) + 360) % 360, s: Math.min(1, Math.max(0, s)) };
}

/** A change someone asked for: only what this device can do. Null when nothing valid is left. */
export function cleanControlChange(type: ControlType, f: ControlFeatures, raw: unknown): ControlState | null {
  if (!isRecord(raw)) return null;
  const out: ControlState = {};
  if (typeof raw.on === "boolean" && type !== "cover") out.on = raw.on;
  if (type === "cover") {
    const p = finite(raw.position);
    if (p !== null) out.position = Math.min(100, Math.max(0, Math.round(p)));
  } else if (type === "fan") {
    const v = finite(raw.speed);
    if (v !== null) out.speed = Math.min(100, Math.max(1, Math.round(v)));
  } else if (type === "light") {
    const b = finite(raw.brightness);
    if (f.brightness && b !== null) out.brightness = Math.min(100, Math.max(1, Math.round(b)));
    const c = cleanColor(raw.color);
    if (f.color && c) {
      out.color = c;
      if (f.white) out.white = false;
    }
    // White wins over a colour sent with it: it is the button that was pressed.
    if (f.white && raw.white === true) {
      out.white = true;
      delete out.color;
    }
  } else {
    const t = finite(raw.target);
    if (t !== null) out.target = snapTemperature(t, f);
  }
  if (type === "thermostat" && typeof raw.preset === "string" && f.presets?.includes(raw.preset)) out.preset = raw.preset;
  if (type === "climate") {
    if (typeof raw.mode === "string" && f.modes?.includes(raw.mode)) out.mode = raw.mode;
    if (typeof raw.fan === "string" && f.fanSpeeds?.includes(raw.fan)) out.fan = raw.fan;
  }
  return Object.keys(out).length ? out : null;
}

/** True while a setting such as Eco decides the temperature, so a new one cannot be sent. */
export function temperatureIsFixed(f: ControlFeatures, state: ControlState): boolean {
  return state.preset !== undefined && (f.fixedPresets ?? []).includes(state.preset);
}

/** A device's report: the parts Nexternel understands. */
export function cleanControlReport(raw: unknown): ControlState | null {
  if (!isRecord(raw)) return null;
  const out: ControlState = {};
  if (typeof raw.on === "boolean") out.on = raw.on;
  if (typeof raw.heating === "boolean") out.heating = raw.heating;
  if (typeof raw.white === "boolean") out.white = raw.white;
  for (const key of ["target", "current", "brightness", "position", "speed", "humidity", "outside"] as const) {
    const n = finite(raw[key]);
    if (n !== null) out[key] = n;
  }
  if (typeof raw.mode === "string") out.mode = raw.mode;
  if (typeof raw.fan === "string") out.fan = raw.fan;
  if (typeof raw.preset === "string") out.preset = raw.preset;
  const c = cleanColor(raw.color);
  if (c) out.color = c;
  return Object.keys(out).length ? out : null;
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.01;
  if (isRecord(a) && isRecord(b)) {
    return Math.abs(Number(a.h) - Number(b.h)) < 1 && Math.abs(Number(a.s) - Number(b.s)) < 0.02;
  }
  return a === b;
}

/** True when the device's report shows the whole change has happened. */
export function reportConfirms(report: ControlState, wanted: ControlState): boolean {
  return (Object.keys(wanted) as (keyof ControlState)[]).every((k) => same(report[k], wanted[k]));
}

/** A change in words, for the Activity log. */
export function describeControlChange(change: ControlState): string {
  const parts: string[] = [];
  if (change.on === true) parts.push("turned on");
  if (change.on === false) parts.push("turned off");
  if (change.target !== undefined) parts.push(`set to ${change.target}°`);
  if (change.preset) parts.push(change.preset);
  if (change.position !== undefined) parts.push(`${change.position}% open`);
  if (change.speed !== undefined) parts.push(`speed ${change.speed}%`);
  if (change.mode) parts.push(`mode ${change.mode}`);
  if (change.fan) parts.push(`fan ${change.fan}`);
  if (change.brightness !== undefined) parts.push(`brightness ${change.brightness}%`);
  if (change.white) parts.push("white light");
  else if (change.color) parts.push("colour changed");
  return parts.join(", ");
}
