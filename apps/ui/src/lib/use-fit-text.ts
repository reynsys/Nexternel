import { useLayoutEffect, useRef } from "react";

/** The smallest a name may become before it is cut with "…" (Rey's pick 21/11: about three quarters). */
export const FIT_TEXT_MIN_SCALE = 0.72;

/**
 * One line of text that does not fit is written smaller, down to `minScale` of its normal size;
 * past that it is cut with "…" as before. Text that fits keeps its normal size. Measured again when
 * the box changes width (phone turned, panel resized) and once the fonts have loaded.
 */
export function useFitText<T extends HTMLElement>(text: string, minScale = FIT_TEXT_MIN_SCALE) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastWidth = -1;
    const fit = () => {
      const room = el.clientWidth;
      if (room === lastWidth) return;
      lastWidth = room;
      el.style.fontSize = "";
      if (room <= 0 || el.scrollWidth <= room) return;
      const base = parseFloat(getComputedStyle(el).fontSize);
      let scale = Math.max(minScale, Math.floor((room / el.scrollWidth) * 100) / 100);
      el.style.fontSize = `${base * scale}px`;
      // Letter spacing does not shrink with the letters: step down until it fits or reaches the floor.
      while (el.scrollWidth > room && scale > minScale) {
        scale = Math.max(minScale, scale - 0.02);
        el.style.fontSize = `${base * scale}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      lastWidth = -1;
      fit();
    });
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [text, minScale]);

  return ref;
}
