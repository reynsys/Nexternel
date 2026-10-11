/**
 * How a panel shows the names and icons of its items — one rule for every panel that lists items
 * (readings, controls, charts, cameras). Settings → Edit panel → Names & icons.
 *
 * Name:  this panel's own name for the item  →  the reading's name  (shortened unless "Full")
 * Icon:  this panel's own icon  →  the reading's icon  →  automatic by kind of reading
 */
import { panelItemLabel } from "./panel-heading";

export type ItemIconsMode = "show" | "hide";
/** short = without the device/room name already in the panel title; full = the whole name. */
export type ItemNamesMode = "short" | "full" | "hide";
/** icon: a catalogue id, "auto" (the reading's own) or "none" (no icon on this panel). */
export type ItemOverride = { name?: string; icon?: string };

export type PanelItemDisplay = {
  icons: ItemIconsMode;
  names: ItemNamesMode;
  overrides: Record<string, ItemOverride>;
};

export const DEFAULT_ITEM_DISPLAY: PanelItemDisplay = { icons: "show", names: "short", overrides: {} };

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function readPanelItemDisplay(config: Record<string, unknown> | undefined | null): PanelItemDisplay {
  const icons: ItemIconsMode = config?.itemIcons === "hide" ? "hide" : "show";
  const names: ItemNamesMode = config?.itemNames === "full" || config?.itemNames === "hide" ? config.itemNames : "short";
  const overrides: Record<string, ItemOverride> = {};
  if (isRecord(config?.itemOverrides)) {
    for (const [id, raw] of Object.entries(config.itemOverrides)) {
      if (!isRecord(raw)) continue;
      const o: ItemOverride = {};
      if (typeof raw.name === "string" && raw.name.trim()) o.name = raw.name.trim();
      if (typeof raw.icon === "string" && raw.icon && raw.icon !== "auto") o.icon = raw.icon;
      if (o.name || o.icon) overrides[id] = o;
    }
  }
  return { icons, names, overrides };
}

/** Saved config with these display settings; defaults are left out so old panels stay unchanged. */
export function writePanelItemDisplay(
  config: Record<string, unknown>,
  display: PanelItemDisplay,
  keepIds?: string[]
): Record<string, unknown> {
  const next = { ...config };
  if (display.icons === "hide") next.itemIcons = "hide";
  else delete next.itemIcons;
  if (display.names !== "short") next.itemNames = display.names;
  else delete next.itemNames;
  const keep = keepIds ? new Set(keepIds) : null;
  const overrides = Object.fromEntries(
    Object.entries(display.overrides).filter(([id, o]) => (!keep || keep.has(id)) && (o.name || o.icon))
  );
  if (Object.keys(overrides).length) next.itemOverrides = overrides;
  else delete next.itemOverrides;
  return next;
}

/** The name and icon one item shows. iconId null = no icon. */
export function resolveItemHeading(opts: {
  itemId?: string | null;
  /** The reading's name (already the owner's own name when one is set). */
  title?: string | null;
  /** The reading's own icon ("auto" or a catalogue id). */
  readingIcon?: string | null;
  /** Shared prefix the panel title already shows (device or room). */
  prefix?: string | null;
  display: PanelItemDisplay;
}): { name: string | null; iconId: string | null } {
  const override = opts.itemId ? opts.display.overrides[opts.itemId] : undefined;
  let name: string | null = null;
  if (opts.display.names !== "hide") {
    if (override?.name) name = override.name;
    else if (opts.title?.trim()) {
      name = opts.display.names === "full" ? opts.title.trim() : panelItemLabel(opts.title, opts.prefix ?? null);
    }
  }
  let iconId: string | null = null;
  if (opts.display.icons === "show" && override?.icon !== "none") {
    iconId = override?.icon ?? opts.readingIcon ?? "auto";
  }
  return { name, iconId };
}
