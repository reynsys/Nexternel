/**
 * Resizing a panel low on the page: hold the pointer near the top or bottom of the screen and the
 * page scrolls by itself at a calm, steady speed (faster closer to the edge). The grid only
 * follows the pointer when it moves, so after each scroll the pointer position is replayed and the
 * panel keeps growing with the page. Scroll anchoring is paused meanwhile, so the browser cannot
 * make the panel grow on its own.
 */
const ZONE = 60; // px from the edge where scrolling starts
const MAX_SPEED = 320; // px per second at the very edge

type Point = { clientX?: number; clientY?: number; touches?: ArrayLike<{ clientX: number; clientY: number }> };

export function pointerOf(e: unknown): { x: number; y: number } | null {
  const p = e as Point;
  const point = p.touches && p.touches.length ? p.touches[0] : p;
  return typeof point?.clientX === "number" && typeof point?.clientY === "number" ? { x: point.clientX, y: point.clientY } : null;
}

/** Scrolling speed (px per second) for a pointer at `y` in a viewport `height` tall (+ down, − up). */
export function edgeSpeed(y: number, height: number): number {
  if (y > height - ZONE) return (Math.min(ZONE, y - (height - ZONE)) / ZONE) * MAX_SPEED;
  if (y < ZONE) return -(Math.min(ZONE, ZONE - y) / ZONE) * MAX_SPEED;
  return 0;
}

export function createEdgeScroller() {
  let last: { x: number; y: number } | null = null;
  let timer = 0;
  let prev = 0;
  let carry = 0;
  const replay = () => {
    if (last) document.dispatchEvent(new MouseEvent("mousemove", { clientX: last.x, clientY: last.y, bubbles: true }));
  };
  const tick = () => {
    const now = performance.now();
    const dt = Math.min(100, now - prev);
    prev = now;
    if (!last) return;
    carry += (edgeSpeed(last.y, window.innerHeight) * dt) / 1000;
    const step = Math.trunc(carry);
    carry -= step;
    if (step) {
      const before = window.scrollY;
      window.scrollTo({ top: before + step, behavior: "instant" });
      if (window.scrollY !== before) replay();
    }
  };
  return {
    start(e: unknown) {
      last = pointerOf(e);
      document.documentElement.style.overflowAnchor = "none";
      document.body.style.overflowAnchor = "none";
      prev = performance.now();
      carry = 0;
      window.clearInterval(timer);
      timer = window.setInterval(tick, 16);
    },
    move(e: unknown) {
      const p = pointerOf(e);
      // A replayed move carries the same position: keep the real one.
      if (p && e instanceof Event && e.isTrusted === false) return;
      last = p ?? last;
    },
    stop() {
      window.clearInterval(timer);
      timer = 0;
      document.documentElement.style.overflowAnchor = "";
      document.body.style.overflowAnchor = "";
      last = null;
    },
  };
}
