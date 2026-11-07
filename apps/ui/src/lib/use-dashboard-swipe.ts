import { useEffect, useRef } from "react";

/** Ignore swipes that start on something that moves sideways by itself (sliders, maps, scroll rows). */
const OWN_SIDEWAYS = [
  "input",
  "textarea",
  "select",
  "[role='slider']",
  ".MuiSlider-root",
  ".MuiModal-root",
  ".leaflet-container",
  "[data-nx-no-swipe]",
].join(",");

function scrollsSideways(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const x = getComputedStyle(n).overflowX;
    if ((x === "auto" || x === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

/** Least sideways travel for a swipe (px), and how much more sideways than up or down it must be. */
const MIN_SWIPE_PX = 70;
const SIDEWAYS_RATIO = 2;

/**
 * Phones: a sideways swipe on the dashboard goes to the next (swipe left) or previous (swipe right)
 * dashboard, in the order of the Dashboards sheet. Off while editing.
 */
export function useDashboardSwipe(enabled: boolean, onSwipe: (dir: 1 | -1) => void) {
  const handler = useRef(onSwipe);
  handler.current = onSwipe;
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      if (e.touches.length !== 1 || !t || !target?.closest("main") || target.closest(OWN_SIDEWAYS) || scrollsSideways(target)) {
        start = null;
        return;
      }
      start = { x: t.clientX, y: t.clientY };
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      if (Math.abs(dx) < MIN_SWIPE_PX || Math.abs(dx) < Math.abs(dy) * SIDEWAYS_RATIO) return;
      handler.current(dx < 0 ? 1 : -1);
    };
    const cancel = () => {
      start = null;
    };
    document.addEventListener("touchstart", down, { passive: true });
    document.addEventListener("touchend", up, { passive: true });
    document.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", down);
      document.removeEventListener("touchend", up);
      document.removeEventListener("touchcancel", cancel);
    };
  }, [enabled]);
}
