import type { WidgetInstance } from "../api";

/**
 * Dashboard tile title — single rule for every panel/plugin type.
 * Show the persisted `widget.title` when the operator set one; otherwise no title row.
 */
export function dashboardTileTitle(widget: WidgetInstance): string | null {
  const title = widget.title?.trim();
  return title || null;
}
