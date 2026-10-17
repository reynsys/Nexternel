/**
 * Switch styles: how an on/off switch is drawn in a panel tile. Chosen like a gauge's style: per
 * panel in its Edit menu (Look tab), and per switch in a panel with several (the switch's own
 * options in the Content tab). Every style draws itself from the Look's tokens.
 */

export const SWITCH_STYLES = [
  { id: "toggle", label: "Toggle", hint: "The classic small switch." },
  { id: "power", label: "Power button", hint: "A round button with the power sign." },
  { id: "rocker", label: "Wall rocker", hint: "Like a light switch on the wall." },
  { id: "pair", label: "ON / OFF pair", hint: "Two buttons side by side." },
  { id: "tile", label: "Tile lights up", hint: "The whole tile glows when on." },
  { id: "lever", label: "Lever", hint: "A handle that slides up and down." },
  { id: "daynight", label: "Day & night", hint: "Night sky when off, sunny sky when on." },
  { id: "cyber", label: "Cyber 0 / 1", hint: "A glowing block that flicks between 0 and 1." },
  { id: "neon", label: "Neon ring", hint: "A glowing border fills around it." },
  { id: "gears", label: "Gears", hint: "Gears turn while it is on." },
  { id: "led", label: "3D with light", hint: "A raised switch with an indicator light." },
  { id: "bigknob", label: "3D big knob", hint: "A big knob that stretches when on." },
] as const;

export type SwitchStyleId = (typeof SWITCH_STYLES)[number]["id"];

export const DEFAULT_SWITCH_STYLE: SwitchStyleId = "toggle";

const IDS = new Set<string>(SWITCH_STYLES.map((s) => s.id));

export function isSwitchStyleId(raw: unknown): raw is SwitchStyleId {
  return typeof raw === "string" && IDS.has(raw);
}

export function normalizeSwitchStyle(raw: unknown): SwitchStyleId {
  return isSwitchStyleId(raw) ? raw : DEFAULT_SWITCH_STYLE;
}

/** A panel's switch style (the classic toggle when it has not chosen one). */
export function readPanelSwitchStyle(config: Record<string, unknown> | undefined): SwitchStyleId {
  const appearance = config?.appearance;
  if (appearance && typeof appearance === "object" && !Array.isArray(appearance)) {
    return normalizeSwitchStyle((appearance as Record<string, unknown>).switchStyle);
  }
  return DEFAULT_SWITCH_STYLE;
}
