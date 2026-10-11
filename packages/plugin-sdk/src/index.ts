/**
 * Plugin SDK contracts — host must not require WidgetRenderer edits per widget.
 */

export type PluginApiVersion = 1;

export interface PluginContributions {
  /** Contributed dashboard panel type ids (`plugin.*`). */
  widgets?: string[];
  /** Alias for {@link PluginContributions.widgets}. */
  panels?: string[];
  drivers?: string[];
  services?: string[];
  navigation?: string[];
  themes?: string[];
}

export interface PluginManifest {
  id: string;
  version: string;
  pluginApi: PluginApiVersion;
  name?: string;
  description?: string;
  contributes: PluginContributions;
}

/** Catalog group for Add Panel picker (contributed panels). */
export type PanelCategoryId =
  | "status"
  | "sensors"
  | "history"
  | "controls"
  | "media"
  | "system"
  | "plugins";

/** @deprecated use PanelCategoryId */
export type WidgetCategoryId = PanelCategoryId;

export type PanelBindingSlotDef = {
  key: string;
  label: string;
  /** Accepted capability kinds (any match). */
  kinds?: string[];
  /** Substrings matched against capability name (case-insensitive). */
  nameHints?: string[];
  /** When true, Add Panel / editor should require a selection. */
  required?: boolean;
};

/** @deprecated use PanelBindingSlotDef */
export type WidgetBindingSlotDef = PanelBindingSlotDef;

/**
 * V5 presentation renderer class — how content is laid out, not where it comes from.
 * Must match apps/ui Panel registry `PanelRendererClass` values.
 */
export type PanelPresentationClass =
  | "semantic-readings"
  | "semantic-controls"
  | "time-series-chart"
  | "live-media"
  | "chart-canvas"
  | "radial-gauge"
  | "composite-tile";

export type PanelContribution = {
  type: string;
  label: string;
  /** Catalog group for Add Panel picker. Defaults to plugins. */
  category?: PanelCategoryId;
  /** When false, Add Panel skips single-capability picker. */
  needsCapability?: boolean;
  /** Named multi-capability bindings (composite panels). */
  bindingSlots?: PanelBindingSlotDef[];
  /** Preferred grid size when added — not a placement minimum. */
  defaultSize?: { w: number; h: number };
  /**
   * Presentation renderer class for placement/responsive contract.
   * Defaults to composite-tile when omitted.
   */
  rendererClass?: PanelPresentationClass;
  /** React component — typed loosely so SDK stays React-free at compile time for API pkgs. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: any;
};

/** @deprecated use PanelContribution */
export type WidgetContribution = PanelContribution;

export interface PluginHostContext {
  registerPanel(contribution: PanelContribution): void;
  /** @deprecated use registerPanel */
  registerWidget(contribution: PanelContribution): void;
  registerPlugin(manifest: PluginManifest): void;
  registerDriver(driverId: string): void;
}

  /** Optional props the UI host may pass to plugin widget components. */
export type PluginWidgetHostProps = {
  editMode?: boolean;
  /** Bumps when the dashboard grid cell resizes (charts should remeasure). */
  layoutEpoch?: number;
  /** When false, do not render an in-widget title (dashboard tile chrome owns it). */
  showBodyHeading?: boolean;
  onCapabilityCommand?: (
    capabilityId: string,
    action: "on" | "off"
  ) => Promise<{ value: unknown } | void>;
};
