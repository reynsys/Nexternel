import type { CapabilityKind } from "./capability.js";
import type { PanelKind } from "./panel-scope.js";
import { normalizePanelKind } from "./panel-scope.js";

/** How a core panel resolves data and which dashboard editor fields apply. */
export type PanelScopeMode = "capabilities" | "area" | "integration";

export type PanelLayoutSize = {
  w: number;
  h: number;
  /** Legacy catalog hint when adding a panel — not the V5 placement minimum. */
  minW: number;
  /** Legacy catalog hint when adding a panel — not the V5 placement minimum. */
  minH: number;
};

export type PanelDefinition = {
  kind: PanelKind;
  label: string;
  description: string;
  scopeMode: PanelScopeMode;
  supportedKinds: readonly CapabilityKind[];
  excludeKinds?: readonly CapabilityKind[];
  /** Shown in Dashboard → Add Panel for normal operators. */
  userSelectable: boolean;
  /** Developer preview page only (all registered kinds render). */
  previewOnly?: boolean;
  sortOrder: number;
  /** Preferred size when a panel is first added (grid units). */
  defaultSize: PanelLayoutSize;
};

/** Core panels — canonical registry; UI loads via API. */
export const CORE_PANEL_REGISTRY: readonly PanelDefinition[] = [
  {
    kind: "panel.controls",
    label: "Controls",
    description: "Switches you can turn on and off.",
    scopeMode: "capabilities",
    supportedKinds: ["switch", "brightness", "colour"],
    userSelectable: true,
    sortOrder: 10,
    defaultSize: { w: 2, h: 2, minW: 2, minH: 2 },
  },
  {
    kind: "panel.status",
    label: "Status",
    description: "Live readings, such as temperature or humidity.",
    scopeMode: "capabilities",
    supportedKinds: [
      "temperature",
      "humidity",
      "pressure",
      "battery",
      "voltage",
      "current",
      "power",
      "energy",
      "co2",
      "pm1",
      "pm25",
      "pm10",
      "number",
      "text",
      "enum",
      "binary_sensor",
      "motion",
      "door",
      "lock",
      "alarm",
    ],
    excludeKinds: ["switch", "brightness", "colour"],
    userSelectable: true,
    sortOrder: 20,
    defaultSize: { w: 4, h: 2, minW: 2, minH: 2 },
  },
  {
    kind: "panel.charts",
    label: "Charts",
    description: "How a reading changes over time.",
    scopeMode: "capabilities",
    supportedKinds: [
      "temperature",
      "humidity",
      "pressure",
      "battery",
      "voltage",
      "current",
      "power",
      "energy",
      "co2",
      "pm1",
      "pm25",
      "pm10",
      "number",
    ],
    excludeKinds: ["switch", "brightness", "colour"],
    userSelectable: true,
    sortOrder: 30,
    defaultSize: { w: 8, h: 4, minW: 4, minH: 2 },
  },
  {
    kind: "panel.camera",
    label: "Cameras",
    description: "Live pictures from your cameras.",
    scopeMode: "area",
    supportedKinds: ["camera"],
    userSelectable: true,
    sortOrder: 40,
    defaultSize: { w: 8, h: 4, minW: 4, minH: 2 },
  },
  {
    kind: "panel.weather",
    label: "Weather",
    description: "Today’s weather and the next few days.",
    scopeMode: "integration",
    supportedKinds: ["weather"],
    userSelectable: true,
    sortOrder: 50,
    defaultSize: { w: 8, h: 4, minW: 4, minH: 2 },
  },
  {
    kind: "panel.calendar",
    label: "Calendar",
    description: "The days of this month.",
    scopeMode: "integration",
    supportedKinds: [],
    userSelectable: true,
    sortOrder: 55,
    defaultSize: { w: 5, h: 7, minW: 3, minH: 3 },
  },
  {
    kind: "panel.clock",
    label: "Clock",
    description: "The time and today’s date.",
    scopeMode: "integration",
    supportedKinds: [],
    userSelectable: true,
    sortOrder: 45,
    defaultSize: { w: 4, h: 4, minW: 2, minH: 2 },
  },
  {
    kind: "panel.devices",
    label: "Devices",
    description: "See which devices are online or offline.",
    scopeMode: "integration",
    supportedKinds: [],
    userSelectable: false,
    sortOrder: 58,
    defaultSize: { w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    kind: "panel.system",
    label: "System information",
    description: "How this home’s server is doing.",
    scopeMode: "integration",
    supportedKinds: [],
    userSelectable: true,
    sortOrder: 60,
    defaultSize: { w: 8, h: 4, minW: 4, minH: 2 },
  },
  {
    kind: "panel.rooms",
    label: "Rooms",
    description: "Every room (dashboard) as a button — press one to open it.",
    scopeMode: "integration",
    supportedKinds: [],
    userSelectable: true,
    sortOrder: 65,
    defaultSize: { w: 2, h: 4, minW: 2, minH: 2 },
  },
];

export function getPanelDefinition(kind: PanelKind): PanelDefinition | undefined {
  return CORE_PANEL_REGISTRY.find((p) => p.kind === kind);
}

export function isCorePanelKind(kind: string): kind is PanelKind {
  return CORE_PANEL_REGISTRY.some((p) => p.kind === kind);
}

export function listUserSelectablePanels(): readonly PanelDefinition[] {
  return CORE_PANEL_REGISTRY.filter((p) => p.userSelectable).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}

export function listPreviewPanels(): readonly PanelDefinition[] {
  return [...CORE_PANEL_REGISTRY].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPanelScopeMode(kind: string): PanelScopeMode {
  const def = getPanelDefinition(normalizePanelKind(kind) as PanelKind);
  return def?.scopeMode ?? "capabilities";
}

export function panelUsesCapabilityScope(kind: string): boolean {
  return getPanelScopeMode(kind) === "capabilities";
}

export function panelUsesAreaScope(kind: string): boolean {
  const mode = getPanelScopeMode(kind);
  return mode === "capabilities" || mode === "area";
}

export function panelIsIntegrationKind(kind: string): boolean {
  return getPanelScopeMode(kind) === "integration";
}
