import type { PanelScopeMode } from "@nexternel/domain";
import type { PanelBindingSlotDef, PanelCategoryId } from "@nexternel/plugin-sdk";
import type { ComponentType } from "react";
import type { Capability } from "../../api";
import type { PanelInstance } from "../../api";

/** V5 semantic responsive states (LAW 016). */
export type PanelResponsiveState = "comfortable" | "compact" | "summary" | "insufficient";

export type PanelSizingContract = {
  preferredWidth?: number;
  minWidth?: number;
  preferredHeight?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  heightPolicy?: "fixed" | "content" | "fill";
  preferredAspectRatio?: number;
  degradationModes?: readonly PanelResponsiveState[];
};

export type PanelAccessibilityContract = {
  /** Primary accessible name when tile title is absent. */
  label: string;
  description?: string;
  /** Landmark role for the Panel frame. */
  role?: "region" | "group";
};

/**
 * Declarative Panel metadata — serializable, no executable code (LAW 012).
 */
export type PanelDescriptor = {
  type: string;
  label: string;
  description?: string;
  category?: PanelCategoryId;
  source: "core" | "contribution" | "plugin" | "echarts";
  configSchemaVersion: number;
  scopeMode?: PanelScopeMode;
  sizing: PanelSizingContract;
  responsive: {
    supportedStates: PanelResponsiveState[];
  };
  accessibility: PanelAccessibilityContract;
  userSelectable: boolean;
  previewOnly?: boolean;
  sortOrder?: number;
  needsCapability?: boolean;
  bindingSlots?: PanelBindingSlotDef[];
  rendererClass: PanelRendererClass;
};

/**
 * V5 presentation renderer class — describes how content is laid out and rendered.
 * Not provenance (core/contribution/plugin) and not product/domain identity (LAW 031).
 */
export type PanelRendererClass =
  | "semantic-readings"
  | "semantic-controls"
  | "time-series-chart"
  | "live-media"
  | "chart-canvas"
  | "radial-gauge"
  | "composite-tile";

export const PANEL_RENDERER_CLASSES: readonly PanelRendererClass[] = [
  "semantic-readings",
  "semantic-controls",
  "time-series-chart",
  "live-media",
  "chart-canvas",
  "radial-gauge",
  "composite-tile",
];

export function isPanelRendererClass(value: string): value is PanelRendererClass {
  return (PANEL_RENDERER_CLASSES as readonly string[]).includes(value);
}

export type PanelImplementationKind =
  | "core-scoped"
  | "specialised"
  | "contribution"
  | "echarts";

/** Props PanelHost passes to a contribution Component (e.g. the bundled gauge). */
export type PanelRenderProps = {
  widget: PanelInstance;
  capabilities: Capability[];
  editMode: boolean;
  showBodyHeading: boolean;
  onCapabilityCommand?: (
    capabilityId: string,
    action: "on" | "off"
  ) => Promise<{ value: unknown }>;
};

/**
 * Trusted runtime implementation — never persisted (LAW 012).
 */
export type PanelImplementation = {
  kind: PanelImplementationKind;
  rendererClass: PanelRendererClass;
  Component?: ComponentType<PanelRenderProps>;
};

export type PanelRegistration = {
  descriptor: PanelDescriptor;
  implementation: PanelImplementation;
};

export type PanelAvailability =
  | "available"
  | "unknown"
  | "plugin_missing"
  | "plugin_disabled"
  | "unsupported_config"
  | "unsupported_legacy";

export type ResolvedPanelRegistration = {
  type: string;
  descriptor: PanelDescriptor | null;
  implementation: PanelImplementation | null;
  availability: PanelAvailability;
  configErrors: string[];
};

export type MigratedPanelConfig = {
  schemaVersion: number;
  data: Record<string, unknown>;
  preservedFields: Record<string, unknown>;
  errors: string[];
};
