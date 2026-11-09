/**
 * Where the room (dashboard) menu sits, per person (Settings → Appearance → Room menu):
 * dock = a floating island at the bottom (default), tabs = a row above the dashboard,
 * rail = the dock standing up on the right. (A Rooms panel can also be added to any dashboard.)
 * Phones (narrow screens) have their own choice, kept on the phone (its own Appearance): the dock in one
 * row that slides under a finger (default), or a row at the top that stays on screen while you scroll.
 * A sideways swipe on the dashboard and Dashboards in the bottom bar (DashboardSheet) also move between them.
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
/** The phone's own choice (Appearance on a phone). */
export type PhoneRoomNav = "dock" | "row";
export const PHONE_ROOM_NAVS: { value: PhoneRoomNav; label: string; description: string }[] = [
  { value: "dock", label: "Dock", description: "Your dashboards at the bottom, above the menu. Slide it to see them all." },
  { value: "row", label: "Row at the top", description: "Your dashboards in a row under the Nexternel bar. It stays there while you scroll." },
];
export function normalizePhoneRoomNav(raw: unknown): PhoneRoomNav {
  return raw === "row" ? "row" : "dock";
}
/** The room menu actually shown: the person's choice, or on narrow screens the phone's own. */
export type ShownRoomNav = RoomNav | "phone" | "phone-row";
export function shownRoomNav(pref: RoomNav, narrow: boolean, phonePref: PhoneRoomNav = "dock"): ShownRoomNav {
  if (!narrow) return pref;
  return phonePref === "row" ? "phone-row" : "phone";
}
/** Drawn as a row above the dashboard (Top tabs, the phone's row) rather than fixed on screen (dock, rail). */
export function roomNavAtTop(shown: ShownRoomNav): boolean {
  return shown === "tabs" || shown === "phone-row";
}
