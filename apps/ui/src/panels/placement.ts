import type { Layout } from "react-grid-layout";

import { migrateContributionPanelType } from "@nexternel/domain";

import type { PanelInstance } from "../api";
import { runtimeConfigToPanelRecord } from "../lib/panel-compatibility/panel-config";
import type { NormalizedPanelConfig } from "../lib/panel-compatibility/types";

import {

  DASHBOARD_GRID_COLS,

  PLATFORM_PLACEMENT_MIN_H,

  PLATFORM_PLACEMENT_MIN_W,

} from "./registry/placement-contract";

import { bootstrapV5PanelRegistry } from "./registry/bootstrap";
import { resolvePanelRegistrationByType } from "./registry/resolve";



export { DASHBOARD_GRID_COLS, PLATFORM_PLACEMENT_MIN_H, PLATFORM_PLACEMENT_MIN_W };

/**
 * What placement reads from a panel. Both the saved record (`PanelInstance`) and the
 * runtime record (`RuntimePanelInstance`) satisfy it; `panelConfigRecord` reads either config shape.
 */
export type PlacementPanel = {
  id: string;
  type: string;
  layout: PanelInstance["layout"];
  config?: unknown;
};



export type PanelPlacementLimits = {

  minW: number;

  minH: number;

  maxW: number;

  maxH: number;

  preferredW: number;

  preferredH: number;

};



function finiteGridUnit(value: unknown, fallback: number): number {

  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;

}



/** Resolve the authoritative Dashboard placement contract for a Panel type (grid units). */

export function panelPlacementLimits(type: string): PanelPlacementLimits {

  bootstrapV5PanelRegistry();

  const migrated = migrateContributionPanelType(type);

  const resolved = resolvePanelRegistrationByType(migrated);

  const sizing = resolved.descriptor?.sizing;

  const minW = Math.max(1, finiteGridUnit(sizing?.minWidth, PLATFORM_PLACEMENT_MIN_W));

  const minH = Math.max(1, finiteGridUnit(sizing?.minHeight, PLATFORM_PLACEMENT_MIN_H));

  const maxW = Math.max(minW, finiteGridUnit(sizing?.maxWidth, DASHBOARD_GRID_COLS));

  const maxH = Math.max(minH, finiteGridUnit(sizing?.maxHeight, 64));

  const preferredW = Math.max(minW, finiteGridUnit(sizing?.preferredWidth, 4));

  const preferredH = Math.max(minH, finiteGridUnit(sizing?.preferredHeight, 3));

  return { minW, minH, maxW, maxH, preferredW, preferredH };

}



/** @deprecated use panelPlacementLimits */

export function panelPlacementMinimums(type: string): { minW: number; minH: number } {

  const limits = panelPlacementLimits(type);

  return { minW: limits.minW, minH: limits.minH };

}



type GridLayoutLike = {

  i?: string;

  x: number;

  y: number;

  w: number;

  h: number;

  minW?: number;

  minH?: number;

  maxW?: number;

  maxH?: number;

};



const MULTI_ITEM_PANELS = new Set(["panel.status", "panel.controls"]);

function panelConfigRecord(panel: PlacementPanel): Record<string, unknown> {
  const config = panel.config;
  if (
    config &&
    typeof config === "object" &&
    "scope" in config &&
    "data" in config &&
    "schemaVersion" in config
  ) {
    return runtimeConfigToPanelRecord(config as NormalizedPanelConfig);
  }
  return (config ?? {}) as Record<string, unknown>;
}

function readPanelScopeRecord(
  config: Record<string, unknown> | undefined
): { contentMode?: string; capabilityIds?: unknown } | null {
  if (!config || typeof config !== "object") return null;
  const scope = config.scope;
  if (scope && typeof scope === "object" && !Array.isArray(scope)) {
    return scope as { contentMode?: string; capabilityIds?: unknown };
  }
  const panelScope = config.panelScope;
  if (panelScope && typeof panelScope === "object" && !Array.isArray(panelScope)) {
    return panelScope as { contentMode?: string; capabilityIds?: unknown };
  }
  return null;
}

function manualCapabilityCount(panel: PlacementPanel): number {
  const scope = readPanelScopeRecord(panelConfigRecord(panel));
  if (!scope || scope.contentMode === "auto" || !Array.isArray(scope.capabilityIds)) return 1;
  const count = scope.capabilityIds.filter((id) => typeof id === "string" && id.trim().length > 0).length;
  return Math.max(1, count);
}

function stacksDown(panel: PlacementPanel): boolean {
  const appearance = panelConfigRecord(panel).appearance;
  if (!appearance || typeof appearance !== "object" || Array.isArray(appearance)) return false;
  return (appearance as { direction?: string }).direction === "down";
}

/**
 * One item keeps the shared floor. Several items need a cell each,
 * across in rows of up to three, or one under another when stacked.
 */
export function panelItemPlacementFloor(panel: PlacementPanel): { minW: number; minH: number } {
  const base = panelPlacementLimits(panel.type);
  const kind = migrateContributionPanelType(panel.type);
  const count = manualCapabilityCount(panel);
  if (!MULTI_ITEM_PANELS.has(kind) || count <= 1) {
    return { minW: base.minW, minH: base.minH };
  }
  const cell = Math.max(base.minW, base.minH, PLATFORM_PLACEMENT_MIN_W);
  if (stacksDown(panel)) {
    return {
      minW: base.minW,
      minH: Math.min(base.maxH, Math.max(base.minH, cell * count)),
    };
  }
  const cols = Math.min(count, 3);
  const rows = Math.ceil(count / cols);
  return {
    minW: Math.min(base.maxW, Math.max(base.minW, cell * cols)),
    minH: Math.min(base.maxH, Math.max(base.minH, cell * rows)),
  };
}

/** Clamp a grid layout item to the Panel placement contract (grid units). */

export function clampLayoutToPanelLimits(type: string, layout: GridLayoutLike): GridLayoutLike {

  const { minW, minH, maxW, maxH } = panelPlacementLimits(type);

  const w = Math.min(maxW, Math.max(layout.w, minW));

  const h = Math.min(maxH, Math.max(layout.h, minH));

  return { ...layout, w, h, minW, minH, maxW, maxH };

}



/** @deprecated use clampLayoutToPanelLimits */

export function clampLayoutToPanelMinimums(type: string, layout: GridLayoutLike) {

  return clampLayoutToPanelLimits(type, layout);

}



/** Normalize a Panel instance layout to the placement contract. */

export function enforcePanelPlacement<T extends PlacementPanel>(panel: T): T {

  const { maxW, maxH } = panelPlacementLimits(panel.type);
  const { minW, minH } = panelItemPlacementFloor(panel);

  const l = panel.layout ?? { i: panel.id, x: 0, y: 0, w: 4, h: 4 };

  const w = Math.min(maxW, Math.max(l.w ?? 4, minW));

  const h = Math.min(maxH, Math.max(l.h ?? 4, minH));

  return {

    ...panel,

    layout: {

      ...l,

      i: typeof l.i === "string" && l.i.trim() ? l.i : panel.id,

      x: finiteGridUnit(l.x, 0),

      y: finiteGridUnit(l.y, 0),

      w,

      h,

      minW,

      minH,

      maxW,

      maxH,

    },

  };

}



/** Build a react-grid-layout item — constraints enforced live during resize. */

export function gridLayoutItemForPanel(panel: PlacementPanel): Layout {

  const enforced = enforcePanelPlacement(panel);

  const l = enforced.layout;

  return {

    i: panel.id,

    x: l.x,

    y: l.y,

    w: l.w,

    h: l.h,

    minW: l.minW,

    minH: l.minH,

    maxW: l.maxW,

    maxH: l.maxH,

  };

}



/** Persist placement owned by the Dashboard — mins/max derived at load from registry. */

export function layoutForPersistence(panel: PlacementPanel): PanelInstance["layout"] {

  const l = enforcePanelPlacement(panel).layout;

  return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h };

}



export function clampSectionLayout(panels: PlacementPanel[], next: Layout[]): Layout[] {

  return next.map((item) => {

    const panel = panels.find((p) => p.id === item.i);

    if (!panel) return item;

    const floor = panelItemPlacementFloor(panel);
    const { maxW, maxH } = panelPlacementLimits(panel.type);
    const w = Math.min(maxW, Math.max(item.w, floor.minW));
    const h = Math.min(maxH, Math.max(item.h, floor.minH));
    return { ...item, w, h, minW: floor.minW, minH: floor.minH, maxW, maxH } as Layout;

  });

}



/** Compare grid placement only — ignores minW/minH constraint fields on RGL items. */

export function gridLayoutsEqual(a: readonly Layout[], b: readonly Layout[]): boolean {

  if (a.length !== b.length) return false;

  const byId = new Map(b.map((item) => [item.i, item]));

  for (const item of a) {

    const other = byId.get(item.i);

    if (!other) return false;

    if (

      item.x !== other.x ||

      item.y !== other.y ||

      item.w !== other.w ||

      item.h !== other.h

    ) {

      return false;

    }

  }

  return true;

}



/** True when persisted panel layouts already match a clamped RGL layout. */

export function panelSectionLayoutMatches(

  panels: PlacementPanel[],

  layout: readonly Layout[]

): boolean {

  if (panels.length !== layout.length) return false;

  for (const panel of panels) {

    const item = layout.find((x) => x.i === panel.id);

    if (!item) return false;

    const pl = panel.layout;

    if (

      pl.x !== item.x ||

      pl.y !== item.y ||

      pl.w !== item.w ||

      pl.h !== item.h

    ) {

      return false;

    }

  }

  return true;

}


