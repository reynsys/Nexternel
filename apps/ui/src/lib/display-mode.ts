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

/** The account's wall display settings (Users → Edit → Wall display); `start` = dashboard id. */
export type WallPrefs = { textSize: number; tabs: boolean; rotate: number; light: boolean; start: string | null };
export const DEFAULT_WALL: WallPrefs = { textSize: 110, tabs: true, rotate: 0, light: true, start: null };

const rotation = (n: number) => (Number.isFinite(n) && Math.round(n) >= 10 ? Math.min(Math.round(n), 3600) : 0);

export function normalizeWallPrefs(raw: unknown): WallPrefs {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    textSize: TEXT_SIZES.includes(o.textSize as number) ? (o.textSize as number) : 110,
    tabs: o.tabs !== false,
    rotate: typeof o.rotate === "number" ? rotation(o.rotate) : 0,
    light: o.light !== false,
    start: typeof o.start === "string" && /^[A-Za-z0-9-]{1,64}$/.test(o.start) ? o.start : null,
  };
}

/** The account's wall settings, with anything given in the address taking priority. */
export function parseDisplayOptions(search: string, wall: WallPrefs = DEFAULT_WALL): DisplayOptions {
  const q = new URLSearchParams(search);
  const text = Number(q.get("text"));
  return {
    active: true,
    textSize: TEXT_SIZES.includes(text) ? text : wall.textSize,
    tabs: q.has("tabs") ? q.get("tabs") !== "0" : wall.tabs,
    rotate: q.has("rotate") ? rotation(Number(q.get("rotate"))) : wall.rotate,
    light: q.has("light") ? q.get("light") !== "0" : wall.light,
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
