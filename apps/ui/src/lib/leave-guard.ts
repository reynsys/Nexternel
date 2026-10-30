import type { MouseEvent } from "react";

/**
 * Leaving a page that has unsaved changes. The page with changes (a dashboard being edited) sets a
 * guard; every way of leaving it — side menu, room menu, All dashboards — calls leaveThen(go), and the
 * guard decides: go straight away when nothing changed, or ask Save / Don't save / Stay first.
 */
type Guard = (go: () => void) => void;
let guard: Guard | null = null;

export function setLeaveGuard(next: Guard | null): void {
  guard = next;
}

/** Run `go` (usually a navigation), after the page with unsaved changes has had its say. */
export function leaveThen(go: () => void): void {
  if (guard) guard(go);
  else go();
}

/**
 * For a link: lets it work normally, unless a page has unsaved changes — then the link waits for the
 * guard and `go` does the navigation.
 */
export function guardLinkClick(e: MouseEvent, go: () => void): boolean {
  if (!guard || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  e.preventDefault();
  leaveThen(go);
  return true;
}
