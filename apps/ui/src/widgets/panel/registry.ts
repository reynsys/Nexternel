import { normalizePanelKind } from "../../lib/panel-kind";
import { normalizePanelInstance } from "../../lib/panel-compatibility/normalize-panel";
import { scopeConfigFromNormalized } from "../../lib/panel-compatibility/panel-scope";
import { isCorePanelType } from "../../lib/panel-compatibility/panel-type";
import type { WidgetInstance } from "../../api";
import {
  loadSelectablePanels,
  panelLabelFromCatalog,
  panelSizeFromCatalog,
  type PanelCatalogEntry,
} from "../../lib/panel-catalog";

let catalogCache: PanelCatalogEntry[] | null = null;

async function ensureCatalog(): Promise<PanelCatalogEntry[]> {
  if (!catalogCache) {
    catalogCache = await loadSelectablePanels();
  }
  return catalogCache;
}

/** Sync helpers use cached catalog when available (after first load). */
const FALLBACK_SIZE = { w: 4, h: 3, minW: 3, minH: 2 };

export function isPanelWidgetType(type: string): boolean {
  return isCorePanelType(type);
}

export function panelLabel(type: string): string {
  const kind = normalizePanelKind(type);
  if (catalogCache) {
    return panelLabelFromCatalog(kind, catalogCache);
  }
  const labels: Record<string, string> = {
    "panel.controls": "Controls",
    "panel.status": "Status",
    "panel.charts": "Charts",
    "panel.camera": "Cameras",
    "panel.weather": "Weather",
    "panel.calendar": "Calendar",
    "panel.clock": "Clock",
    "panel.devices": "Devices",
    "panel.system": "System",
    "panel.rooms": "Rooms",
  };
  return labels[kind] ?? "Panel";
}

export function panelDefaultSize(type: string): {
  w: number;
  h: number;
  minW: number;
  minH: number;
} {
  const kind = normalizePanelKind(type);
  if (catalogCache) {
    return panelSizeFromCatalog(kind, catalogCache);
  }
  return FALLBACK_SIZE;
}

/** Read normalized scope for editors and runtime adapters. */
export function readPanelScope(widget: WidgetInstance) {
  const panel = normalizePanelInstance(widget);
  return scopeConfigFromNormalized(panel.config.scope);
}

export function normalizedPanelKind(type: string): string {
  return normalizePanelKind(type);
}

export async function fetchSelectablePanelOptions(): Promise<PanelCatalogEntry[]> {
  const catalog = await ensureCatalog();
  catalogCache = catalog;
  return catalog;
}

export type CorePanelKind = string;

/** @deprecated use CorePanelKind */
export type Phase4PanelKind = CorePanelKind;
