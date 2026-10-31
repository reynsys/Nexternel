import { measureLayoutSize } from "./panel-size.ts";

/** Authoritative rectangle available to a visualization renderer (floor-rounded px). */
export type VisualizationRect = {
  width: number;
  height: number;
};

export const EMPTY_VISUALIZATION_RECT: VisualizationRect = { width: 0, height: 0 };

/** Floor pixel dimensions from a visualization slot or host element. */
export function measureVisualizationRect(el: HTMLElement): VisualizationRect {
  return measureLayoutSize(el);
}

/** True when a ResizeObserver callback should publish new visualization context state. */
export function visualizationRectChanged(
  prev: VisualizationRect,
  next: VisualizationRect
): boolean {
  return prev.width !== next.width || prev.height !== next.height;
}

export function isVisualizationRectReady(rect: VisualizationRect): boolean {
  return rect.width > 0 && rect.height > 0;
}
