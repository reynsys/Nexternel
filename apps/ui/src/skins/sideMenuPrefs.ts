/** Persist side-menu collapsed (icons-only) state. */

export const SIDE_MENU_COLLAPSED_KEY = "nexternel.sideMenuCollapsed";

export function getSideMenuCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDE_MENU_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSideMenuCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDE_MENU_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export const SIDE_MENU_WIDTH_EXPANDED = 240;
export const SIDE_MENU_WIDTH_COLLAPSED = 72;
