/**
 * Animations on/off. Each person turns a Look's moving decorations on or off (Settings →
 * Appearance → Animations); each panel can follow that, or be always on / always off (Edit →
 * Look). Everything a Look animates sits inside an element marked "nx-anim" (LookDecor, switch
 * styles), and the CSS in SkinProvider stops it when off, showing its finished still state.
 */
export type PanelMotion = "follow" | "on" | "off";

export function readPanelMotion(config: Record<string, unknown> | undefined): PanelMotion {
  const appearance = config?.appearance;
  if (appearance && typeof appearance === "object" && !Array.isArray(appearance)) {
    const m = (appearance as Record<string, unknown>).motion;
    if (m === "on" || m === "off") return m;
  }
  return "follow";
}

/** The CSS that stops animations: everywhere when off (except panels set to on), and in panels set to off. */
export const MOTION_CSS = `
html[data-nx-motion="off"] :is(.nx-anim, .nx-anim *):not([data-nx-panel-motion="on"] *) { animation: none !important; }
[data-nx-panel-motion="off"] :is(.nx-anim, .nx-anim *) { animation: none !important; }
`;

/** Saved config with this panel's Animations choice ("follow" leaves nothing behind). */
export function writePanelMotion(config: Record<string, unknown>, motion: PanelMotion): Record<string, unknown> {
  const prev = config.appearance && typeof config.appearance === "object" && !Array.isArray(config.appearance)
    ? { ...(config.appearance as Record<string, unknown>) }
    : {};
  if (motion === "follow") delete prev.motion;
  else prev.motion = motion;
  const next = { ...config };
  if (Object.keys(prev).length) next.appearance = prev;
  else delete next.appearance;
  return next;
}
