import { getPanelRegistration } from "../panels/registry/store";
import type { CameraRecord, Capability } from "../api";
import { visiblePanelCameras } from "./panel-cameras";
import type { RuntimePanelInstance } from "./panel-compatibility/types";
import { runtimeConfigToPanelRecord } from "./panel-compatibility/panel-config";
import { capabilityWidgetTitle, tidyDeviceName } from "./capability-labels";
import { dashboardTileTitle } from "./dashboard-tile";
import { normalizePanelKind } from "./panel-kind";
import { effectivePanelScope } from "./panel-scope";
import { panelItemContextLine } from "../panels/panel-item-context";
import { readPanelWeatherConfig } from "./panel-integration";
import { allCapabilityIds } from "./widget-bindings";

/** Title tile height — every panel uses this when the title tile has text. */
export const PANEL_TITLE_TILE_HEIGHT = "30px";

export const PANEL_TITLE_NAME_LINE_PX = 17;
export const PANEL_TITLE_AREA_LINE_PX = 13;

/** One line, cut with an ellipsis — shared by every title tile line. */
const singleLineSx = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
} as const;

/** Title line — every panel title tile uses this only (no MUI variant overrides). */
export const panelTitleNameSx = {
  ...singleLineSx,
  width: "100%",
  fontWeight: 600,
  fontSize: "0.8125rem",
  lineHeight: "17px",
  color: "text.primary",
  margin: 0,
} as const;

/** Area line in the panel title tile only. */
export const panelTitleAreaSx = {
  ...singleLineSx,
  width: "100%",
  fontSize: "0.6875rem",
  lineHeight: "13px",
  fontWeight: 400,
  color: "text.secondary",
  margin: 0,
} as const;

/** Chart history range on the right of the area line — not full width (avoids left-aligned range). */
export const panelTitleRangeSx = {
  ...singleLineSx,
  flexShrink: 0,
  fontSize: "0.6875rem",
  lineHeight: "13px",
  fontWeight: 400,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
} as const;

/** Month shown on a calendar, the same words in the title tile and in a preview. */
export function calendarTitleLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

type PanelHeadingSource = Pick<
  RuntimePanelInstance,
  "id" | "type" | "title" | "bindings" | "config"
>;

function panelDataConfig(panel: PanelHeadingSource): Record<string, unknown> {
  return runtimeConfigToPanelRecord(panel.config);
}

/** Name of a panel that is one thing, such as the month. */
function singlePurposeTitle(panel: PanelHeadingSource): { title: string; area: string | null } | null {
  const kind = normalizePanelKind(panel.type);
  if (kind === "panel.calendar") return { title: calendarTitleLabel(), area: null };
  if (kind === "panel.clock") return { title: "Clock", area: null };
  if (kind === "panel.weather") return { title: "Weather", area: null };
  if (kind === "panel.system") return { title: "System information", area: null };
  if (kind === "panel.devices") return { title: "Devices", area: null };
  if (kind === "panel.charts") return { title: "Charts", area: null };
  if (kind.startsWith("plugin.")) {
    const label = getPanelRegistration(kind)?.descriptor.label;
    return label ? { title: label, area: null } : null;
  }
  return null;
}

export type PanelHeading = {
  title: string | null;
  area: string | null;
  /** The title tile is showing this panel's only item, so the body must not repeat the name. */
  ownsItemName: boolean;
  /** The panel's only reading, when it shows exactly one (its icon is the title's automatic icon). */
  item?: Capability | null;
  /**
   * Words every item name starts with (e.g. the shared device "Hallway Monitor"), shown once
   * in the title tile and dropped from each item label. Null when items share nothing.
   */
  itemPrefix: string | null;
};

/** Label for a kind when its items share no device or area (option A fallback). */
const MULTI_ITEM_KIND_TITLE: Record<string, string> = {
  "panel.status": "Status",
  "panel.controls": "Controls",
  "panel.charts": "Charts",
  "panel.camera": "Cameras",
};

/** Item label with the panel's shared prefix removed ("Hallway Monitor CO2" → "CO2"). */
export function panelItemLabel(name: string, prefix: string | null): string {
  const label = name.trim();
  const shared = prefix?.trim();
  if (!shared || label.length <= shared.length) return label;
  if (label.slice(0, shared.length).toLowerCase() !== shared.toLowerCase()) return label;
  const rest = label.slice(shared.length);
  if (!/^[\s\-–—:·]/.test(rest)) return label;
  const trimmed = rest.replace(/^[\s\-–—:·]+/, "").trim();
  return trimmed || label;
}

/** The one value every entry has, or null (ignores case and surrounding space). */
function sharedValue(values: (string | null | undefined)[]): string | null {
  const first = values[0]?.trim();
  if (!first) return null;
  return values.every((v) => v?.trim().toLowerCase() === first.toLowerCase()) ? first : null;
}

function manualScopeIds(panel: PanelHeadingSource): string[] {
  const scope = panel.config.scope;
  if (scope.contentMode !== "manual") return [];
  return scope.capabilityIds.filter((id) => id.trim().length > 0);
}

function sectionScopeAreaLabel(
  panel: PanelHeadingSource,
  capabilities: Capability[],
  sectionRoomId?: string | null
): string | null {
  const scope = effectivePanelScope(panel.config.scope, sectionRoomId ?? null);
  const areaIds =
    sectionRoomId && !scope.areaIds.includes(sectionRoomId)
      ? [...scope.areaIds, sectionRoomId]
      : scope.areaIds;
  for (const areaId of areaIds) {
    const cap = capabilities.find((c) => c.areaId === areaId && c.roomName?.trim());
    if (cap?.roomName?.trim()) return cap.roomName.trim();
  }
  return null;
}

function integrationTitleArea(panel: PanelHeadingSource): string | null {
  const kind = normalizePanelKind(panel.type);
  if (kind !== "panel.weather") return null;
  const cfg = readPanelWeatherConfig(panelDataConfig(panel));
  const loc = cfg.weatherLocation;
  if (typeof loc === "string" && loc.trim() && loc.trim() !== "Weather") {
    return loc.trim();
  }
  return null;
}

function capabilitiesInPanelScope(
  panel: PanelHeadingSource,
  capabilities: Capability[],
  sectionRoomId?: string | null
): Capability[] {
  const kind = normalizePanelKind(panel.type);
  if (
    kind !== "panel.status" &&
    kind !== "panel.controls" &&
    kind !== "panel.charts"
  ) {
    return [];
  }
  const scope = effectivePanelScope(panel.config.scope, sectionRoomId ?? null);
  if (scope.contentMode === "manual" && scope.capabilityIds.length > 0) {
    const pick = new Set(scope.capabilityIds);
    return capabilities.filter((c) => pick.has(c.id));
  }
  let list = capabilities;
  if (scope.areaIds.length > 0) {
    list = list.filter((c) => c.areaId && scope.areaIds.includes(c.areaId));
  }
  if (scope.systemIds.length > 0) {
    list = list.filter((c) => c.systemId && scope.systemIds.includes(c.systemId));
  }
  if (scope.groupIds.length > 0) {
    list = list.filter((c) => c.groupId && scope.groupIds.includes(c.groupId));
  }
  if (kind === "panel.status" || kind === "panel.charts") {
    list = list.filter((c) => c.kind !== "switch");
  }
  return list;
}

/** Capability ids that identify the panel: a gauge binding, or a hand-picked panel list. */
export function panelHeadingCapabilityIds(panel: PanelHeadingSource): string[] {
  const bound = allCapabilityIds(panel.bindings);
  if (bound.length > 0) return bound;
  return manualScopeIds(panel);
}

/**
 * Camera panels follow the same rules with cameras as the items: one camera names the
 * title strip (its area below); several share a title strip of what they have in common.
 */
function cameraPanelHeading(
  panel: PanelHeadingSource,
  custom: string | null,
  cameras: readonly CameraRecord[],
  sectionRoomId?: string | null
): PanelHeading {
  const scope = effectivePanelScope(panel.config.scope, sectionRoomId ?? null);
  const shown = visiblePanelCameras(cameras, scope);
  const fallback = MULTI_ITEM_KIND_TITLE["panel.camera"]!;
  if (shown.length === 1) {
    const cam = shown[0]!;
    const title = custom || cam.name.trim() || fallback;
    const area = custom ? cam.name.trim() : cam.areaName?.trim() || null;
    return {
      title,
      area: area && area.toLowerCase() !== title.toLowerCase() ? area : null,
      ownsItemName: true,
      itemPrefix: null,
    };
  }
  const room = shown.length > 1 ? sharedValue(shown.map((c) => c.areaName)) : null;
  const title = custom || room || fallback;
  return {
    title,
    area: room && room.toLowerCase() !== title.toLowerCase() ? room : null,
    ownsItemName: false,
    itemPrefix: null,
  };
}

/** Every capability the panel shows, as far as the dashboard can tell before the body loads. */
function headingItems(
  panel: PanelHeadingSource,
  capabilities: Capability[],
  sectionRoomId?: string | null
): Capability[] {
  const ids = panelHeadingCapabilityIds(panel);
  if (ids.length > 0) {
    const byId = new Map(capabilities.map((c) => [c.id, c]));
    return ids.map((id) => byId.get(id)).filter((c): c is Capability => Boolean(c));
  }
  return capabilitiesInPanelScope(panel, capabilities, sectionRoomId);
}

/**
 * Title tile for every panel.
 * One item: its name and area live here.
 * Several items: the operator title, else what the items share — device, then area —
 * else the panel type. Each item keeps only the part of its name that differs.
 */
export function panelHeading(
  panel: PanelHeadingSource,
  capabilities: Capability[],
  sectionRoomId?: string | null,
  cameras: readonly CameraRecord[] = []
): PanelHeading {
  const custom = dashboardTileTitle({
    ...panel,
    layout: { i: panel.id, x: 0, y: 0, w: 1, h: 1 },
    config: panelDataConfig(panel),
  });
  const kind = normalizePanelKind(panel.type);
  if (kind === "panel.camera") {
    return cameraPanelHeading(panel, custom, cameras, sectionRoomId);
  }

  const items = headingItems(panel, capabilities, sectionRoomId);
  if (items.length > 1) {
    const device = sharedValue(items.map((c) => c.deviceName));
    const room = sharedValue(items.map((c) => c.roomName));
    const deviceTitle = device ? tidyDeviceName(device, room) : null;
    const title =
      custom || deviceTitle || room || MULTI_ITEM_KIND_TITLE[kind] || null;
    let area = room && title?.toLowerCase() !== room.toLowerCase() ? room : null;
    if (!area && kind === "panel.charts" && !room) {
      area = sectionScopeAreaLabel(panel, capabilities, sectionRoomId);
    }
    return {
      title,
      area,
      ownsItemName: false,
      itemPrefix: device ?? room,
    };
  }

  const single = items[0];
  const named = single ? capabilityWidgetTitle(single).trim() : "";
  const purpose = !named && !custom ? singlePurposeTitle(panel) : null;
  const title = custom || named || purpose?.title || null;
  let area = single ? panelItemContextLine(single).trim() : "";
  if (!area && custom) {
    const fallbackPurpose = singlePurposeTitle(panel);
    if (fallbackPurpose?.title && fallbackPurpose.title !== custom) {
      area = fallbackPurpose.title;
    }
  }
  if (!area && purpose?.area) area = purpose.area;
  if (!area) {
    const integrationArea = integrationTitleArea(panel);
    if (integrationArea) area = integrationArea;
  }
  if (!area && kind === "panel.charts") {
    const scopeArea = sectionScopeAreaLabel(panel, capabilities, sectionRoomId);
    if (scopeArea) area = scopeArea;
  }
  if (area && title && area.toLowerCase() === title.toLowerCase()) area = "";
  const ownsItemName =
    Boolean(title) && (Boolean(single) || (Boolean(purpose) && kind !== "panel.devices" && kind !== "panel.charts"));
  return {
    title,
    area: area || null,
    ownsItemName,
    itemPrefix: null,
    item: single ?? null,
  };
}
