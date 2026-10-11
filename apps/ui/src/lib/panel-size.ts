/** Measured panel content area (pixels, floor-rounded). */
export type PanelContentSize = {
  width: number;
  height: number;
};

export const EMPTY_PANEL_CONTENT_SIZE: PanelContentSize = { width: 0, height: 0 };

/** Floor pixel dimensions from a content host element. */
export function measurePanelContentSize(el: HTMLElement): PanelContentSize {
  const r = el.getBoundingClientRect();
  const width = Math.max(0, Math.floor(r.width));
  const height = Math.max(0, Math.floor(r.height));
  return { width, height };
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
