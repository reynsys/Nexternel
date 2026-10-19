/**
 * Autoscroll for wall displays (Display mode): a panel whose content is taller than the panel
 * scrolls slowly down, waits at the bottom, returns to the top and waits again — so everything
 * in it can be read on a screen nobody touches. Only scrolling areas inside panels move; a panel
 * someone has just touched or scrolled is left alone for a while.
 */
const SPEED = 18; // px per second
const WAIT_TOP = 4000; // ms before scrolling down
const WAIT_BOTTOM = 3000; // ms at the bottom before returning
const REST_AFTER_TOUCH = 20000; // ms a touched panel is left alone

type Phase = "top" | "down" | "bottom";
type Area = { el: HTMLElement; phase: Phase; since: number; pos: number; touchedAt: number };

/** What an area does next, given how long it has been in its phase. Pure, for tests. */
export function nextPhase(phase: Phase, waited: number, atBottom: boolean): Phase {
  if (phase === "top") return waited >= WAIT_TOP ? "down" : "top";
  if (phase === "down") return atBottom ? "bottom" : "down";
  return waited >= WAIT_BOTTOM ? "top" : "bottom";
}

function scrollAreas(): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const body of document.querySelectorAll<HTMLElement>("[data-nx-panel-body]")) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n as HTMLElement;
      // Cheap size check first; the style is only read for elements that really have more content.
      if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 4) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === "auto" || overflowY === "scroll") found.push(el);
      }
    }
  }
  return found;
}

/** Start autoscrolling; returns a function that stops it. */
export function startAutoScroll(): () => void {
  const areas = new Map<HTMLElement, Area>();
  let last = performance.now();
  const touched = (e: Event) => {
    const t = e.target as Element | null;
    for (const a of areas.values()) if (t && a.el.contains(t)) a.touchedAt = performance.now();
  };
  const refresh = () => {
    const now = performance.now();
    const current = new Set(scrollAreas());
    for (const el of current) if (!areas.has(el)) areas.set(el, { el, phase: "top", since: now, pos: el.scrollTop, touchedAt: -Infinity });
    for (const el of [...areas.keys()]) if (!current.has(el) || !el.isConnected) areas.delete(el);
  };
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(200, now - last);
    last = now;
    for (const a of areas.values()) {
      if (now - a.touchedAt < REST_AFTER_TOUCH) continue;
      const max = a.el.scrollHeight - a.el.clientHeight;
      const next = nextPhase(a.phase, now - a.since, a.el.scrollTop >= max - 1);
      if (next !== a.phase) {
        a.phase = next;
        a.since = now;
        if (next === "top") {
          a.el.scrollTo({ top: 0, behavior: "smooth" });
          a.pos = 0;
        }
        if (next === "down") a.pos = a.el.scrollTop;
      }
      if (a.phase === "down") {
        a.pos = Math.min(max, a.pos + (SPEED * dt) / 1000);
        a.el.scrollTop = a.pos;
      }
    }
  };
  refresh();
  const scan = window.setInterval(refresh, 3000);
  const timer = window.setInterval(tick, 50);
  window.addEventListener("pointerdown", touched, true);
  window.addEventListener("wheel", touched, { capture: true, passive: true });
  return () => {
    window.clearInterval(scan);
    window.clearInterval(timer);
    window.removeEventListener("pointerdown", touched, true);
    window.removeEventListener("wheel", touched, true);
  };
}
