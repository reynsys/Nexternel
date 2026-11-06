/** The size rooms are drawn at, and the smallest that is still easy to press. */
export const DOCK_TILE = 46;
export const DOCK_MIN_TILE = 38;

/**
 * Every room is always on show, as on a real dock: rooms shrink evenly to fit the width there is, and
 * when they would get too small to press they take two rows, so none is ever out of reach.
 * `available` is the width for rooms and buttons; `tools` counts the buttons after the rooms.
 */
export function dockFit(available: number, rooms: number, tools: number, gap: number): { size: number; columns: number } {
  const fit = (columns: number) => Math.floor((available - gap * (columns + tools)) / (columns + tools));
  if (fit(rooms) >= DOCK_MIN_TILE || rooms < 2) return { size: Math.min(DOCK_TILE, Math.max(DOCK_MIN_TILE, fit(rooms))), columns: rooms };
  const columns = Math.ceil(rooms / 2);
  return { size: Math.min(DOCK_TILE, Math.max(DOCK_MIN_TILE, fit(columns))), columns };
}
