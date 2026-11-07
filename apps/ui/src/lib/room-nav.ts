/**
 * Where the room (dashboard) menu sits, per person (Settings → Appearance → Room menu):
 * dock = a floating island at the bottom (default), tabs = a row above the dashboard,
 * rail = the dock standing up on the right. (A Rooms panel can also be added to any dashboard.)
 * Phones (narrow screens) show the dock in one row that slides under a finger; a sideways swipe on the
 * dashboard and Dashboards in the bottom bar (DashboardSheet) also move between dashboards.
 */
export type RoomNav = "dock" | "tabs" | "rail";
export const ROOM_NAVS: { value: RoomNav; label: string; description: string }[] = [
  { value: "dock", label: "Dock", description: "A floating island at the bottom that grows with your dashboards." },
  { value: "tabs", label: "Top tabs", description: "A row of dashboard buttons above the dashboard." },
  { value: "rail", label: "Right rail", description: "The dock standing up on the right." },
];
export function normalizeRoomNav(raw: unknown): RoomNav {
  return ROOM_NAVS.some((n) => n.value === raw) ? (raw as RoomNav) : "dock";
}
/** The room menu actually shown: the person's choice, or the phone's own way on narrow screens. */
export type ShownRoomNav = RoomNav | "phone";
export function shownRoomNav(pref: RoomNav, narrow: boolean): ShownRoomNav {
  return narrow ? "phone" : pref;
}
