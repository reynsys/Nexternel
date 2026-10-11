import type { WidgetInstance } from "../../api";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";
import { widgetTitleOr } from "./config";

/** Heading inside widget body — suppressed when the dashboard tile owns the title row. */
export function useWidgetBodyHeading(
  widget: WidgetInstance,
  fallback: string
): string | undefined {
  const { showBodyHeading } = useDashboardTileChrome();
  if (!showBodyHeading) return undefined;
  return widgetTitleOr(widget, fallback);
}
