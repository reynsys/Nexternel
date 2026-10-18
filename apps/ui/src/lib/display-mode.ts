import { useSyncExternalStore } from "react";

/**
 * Display mode: a dashboard shown full screen on a wall display or tablet (address /display or
 * /display/<name>). No menu and no editing; options come from the address:
 *   ?text=90|100|110|125   text size (default 110, readable from across the room)
 *   ?tabs=0                hide the room buttons
 *   ?rotate=<seconds>      move to the next dashboard every so often (at least 10 s)
 *   ?light=0               keep every effect (default: light — no blur, glows or background
 *                          effects, so small computers such as a Raspberry Pi stay smooth)
 */
export type DisplayOptions = { active: boolean; textSize: number; tabs: boolean; rotate: number; light: boolean };

export const NOT_DISPLAY: DisplayOptions = { active: false, textSize: 100, tabs: true, rotate: 0, light: false };
const TEXT_SIZES = [90, 100, 110, 125];

export function parseDisplayOptions(search: string): DisplayOptions {
  const q = new URLSearchParams(search);
  const text = Number(q.get("text"));
  const rotate = Math.round(Number(q.get("rotate")));
  return {
    active: true,
    textSize: TEXT_SIZES.includes(text) ? text : 110,
    tabs: q.get("tabs") !== "0",
    rotate: Number.isFinite(rotate) && rotate >= 10 ? Math.min(rotate, 3600) : 0,
    light: q.get("light") !== "0",
  };
}

/** A dashboard's normal address ("/" or "/d/<name>") as its Display mode address. */
export function displayPath(path: string): string {
  return path === "/" ? "/display" : `/display${path.replace(/^\/d(?=\/)/, "")}`;
}

let current: DisplayOptions = NOT_DISPLAY;
const subs = new Set<() => void>();
export function setDisplayMode(next: DisplayOptions): void {
  current = next;
  for (const s of subs) s();
}
export function useDisplayMode(): DisplayOptions {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
    () => current
  );
}

/** While light: no see-through blur and no glow filters on decorations (the costly parts on small computers). */
export const LIGHT_CSS = `
html[data-nx-light] *, html[data-nx-light] *::before, html[data-nx-light] *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
html[data-nx-light] .nx-anim, html[data-nx-light] .nx-anim * { filter: none !important; }`;
