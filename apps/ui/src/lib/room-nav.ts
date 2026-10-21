/**
 * Where the room (dashboard) menu sits, per person (Settings → Appearance → Room menu):
 * dock = a floating island at the bottom (default), tabs = a row above the dashboard,
 * rail = a column on the right that folds. (A Rooms panel can also be added to any dashboard.)
 * Narrow screens always use the dock (as a bottom bar).
 */
export type RoomNav = "dock" | "tabs" | "rail";
export const ROOM_NAVS: { value: RoomNav; label: string; description: string }[] = [
  { value: "dock", label: "Dock", description: "A floating island at the bottom that grows with your rooms." },
  { value: "tabs", label: "Top tabs", description: "A row of room buttons above the dashboard." },
  { value: "rail", label: "Right rail", description: "A column on the right that folds away." },
];
export function normalizeRoomNav(raw: unknown): RoomNav {
  return ROOM_NAVS.some((n) => n.value === raw) ? (raw as RoomNav) : "dock";
}
/** The room menu actually shown: narrow screens use the dock. */
export function shownRoomNav(pref: RoomNav, narrow: boolean): RoomNav {
  return narrow ? "dock" : pref;
}
