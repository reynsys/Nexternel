import type { PanelContentMode } from "@nexternel/domain";
import type { DashboardDocument, DashboardSection, PanelInstance } from "../../api";

/** Runtime availability of a normalized Panel instance. */
export type PanelAvailability =
  | "known"
  | "unknown"
  | "unsupported_legacy";

export type NormalizedPanelScope = {
  inheritSectionArea: boolean;
  areaIds: string[];
  systemIds: string[];
  groupIds: string[];
  contentMode: PanelContentMode;
  capabilityIds: string[];
  cameraIds: string[];
};

export type NormalizedPanelConfig = {
  /** Configuration schema generation understood by the compatibility layer. */
  schemaVersion: number;
  scope: NormalizedPanelScope;
  /** Panel-specific configuration excluding scope (chart, weather, appearance, …). */
  data: Record<string, unknown>;
  /**
   * Top-level config keys not interpreted by the compatibility layer.
   * Preserved for forward compatibility and unknown Panels.
   */
  preservedFields: Record<string, unknown>;
};

/**
 * Logical Panel instance after compatibility normalization.
 * Does not include Dashboard placement (RGL layout).
 */
export type NormalizedPanelInstance = {
  id: string;
  type: string;
  title?: string;
  bindings: Record<string, unknown>;
  config: NormalizedPanelConfig;
  compatibility: {
    /** Persisted type before compatibility migration. */
    sourceType: string;
    availability: PanelAvailability;
    legacyScopeSource: "panelScope" | "viewScope" | null;
    typeMigrated: boolean;
  };
};

export type NormalizedPanelRoute = "core" | "contribution" | "echarts" | "unknown";

export const PANEL_CONFIG_SCHEMA_VERSION = 1;

/**
 * Canonical in-memory Panel for dashboard runtime (decode output + RGL placement).
 * `config.scope` / `config.data` are the only runtime configuration concepts.
 * `compatibility` is decode metadata for persistence egress — not for renderers.
 */
export type RuntimePanelInstance = NormalizedPanelInstance & {
  layout: PanelInstance["layout"];
};

export type RuntimeDashboardSection = Omit<DashboardSection, "panels"> & {
  panels: RuntimePanelInstance[];
};

/** Dashboard document after full ingress (runtime sections with decoded panels). */
export type RuntimeDashboardDocument = Omit<DashboardDocument, "sections"> & {
  sections: RuntimeDashboardSection[];
};
