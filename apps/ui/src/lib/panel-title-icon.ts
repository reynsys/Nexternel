/**
 * The icon in a panel's title bar — one rule for every kind of panel.
 *
 *   the panel's own choice ("titleIcon": an icon id, or "none")
 *   → automatic: the panel's only reading's icon (this panel's item icon, else the reading's own)
 *   → automatic: the kind of panel (clock, calendar, weather, several readings, …)
 */
import { normalizePanelKind } from "./panel-kind";
import type { PanelHeading } from "./panel-heading";
import { readPanelItemDisplay } from "./panel-item-display";

/** "auto", "none" or an icon id. */
export function readTitleIcon(config: Record<string, unknown> | undefined | null): string {
  const v = config?.titleIcon;
  return typeof v === "string" && v.trim() ? v.trim() : "auto";
}

export function writeTitleIcon(config: Record<string, unknown>, value: string): Record<string, unknown> {
  const next = { ...config };
  if (!value || value === "auto") delete next.titleIcon;
  else next.titleIcon = value;
  return next;
}

/** What the title bar shows. iconId null = no icon; "auto" = the icon for `kind`. */
export function panelTitleIcon(
  panelType: string,
  config: Record<string, unknown>,
  heading: Pick<PanelHeading, "item">,
  opts: { ignoreChoice?: boolean } = {}
): { iconId: string | null; kind: string | null } {
  const chosen = opts.ignoreChoice ? "auto" : readTitleIcon(config);
  const item = heading.item ?? null;
  if (chosen === "none") return { iconId: null, kind: null };
  if (chosen !== "auto") return { iconId: chosen, kind: item?.kind ?? null };
  if (item) {
    const override = readPanelItemDisplay(config).overrides[item.id]?.icon;
    if (override === "none") return { iconId: null, kind: null };
    return { iconId: override ?? item.icon ?? "auto", kind: item.kind };
  }
  return { iconId: "auto", kind: normalizePanelKind(panelType) };
}
