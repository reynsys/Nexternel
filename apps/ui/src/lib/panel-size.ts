/** Measured panel content area (pixels, floor-rounded). */
export type PanelContentSize = {
  width: number;
  height: number;
};

export const EMPTY_PANEL_CONTENT_SIZE: PanelContentSize = { width: 0, height: 0 };

/**
 * An element's own size in pixels (floor-rounded), unaffected by a shrunk or enlarged parent:
 * the panel editor's preview shows the panel at its dashboard size and scales it down to fit,
 * and what is inside must still lay out for the dashboard size, not the scaled-down picture.
 */
export function measureLayoutSize(el: HTMLElement): PanelContentSize {
  const r = el.getBoundingClientRect();
  // The on-screen size includes any scaling; the element's layout size (offsetWidth/Height) does not.
  const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
  const sy = el.offsetHeight ? r.height / el.offsetHeight : 1;
  return {
    width: Math.max(0, Math.floor(Math.abs(sx - 1) > 0.01 ? r.width / sx : r.width)),
    height: Math.max(0, Math.floor(Math.abs(sy - 1) > 0.01 ? r.height / sy : r.height)),
  };
}

/** Floor pixel dimensions from a content host element. */
export function measurePanelContentSize(el: HTMLElement): PanelContentSize {
  return measureLayoutSize(el);
}

/** True when a ResizeObserver callback should publish new context state. */
export function panelContentSizeChanged(
  prev: PanelContentSize,
  next: PanelContentSize
): boolean {
  return prev.width !== next.width || prev.height !== next.height;
}

export function isPanelContentSizeReady(size: PanelContentSize): boolean {
  return size.width > 0 && size.height > 0;
}
