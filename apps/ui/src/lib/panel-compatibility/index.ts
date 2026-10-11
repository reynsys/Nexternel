export type {
  NormalizedPanelConfig,
  NormalizedPanelInstance,
  NormalizedPanelRoute,
  NormalizedPanelScope,
  PanelAvailability,
  RuntimeDashboardDocument,
  RuntimeDashboardSection,
  RuntimePanelInstance,
} from "./types";
export { PANEL_CONFIG_SCHEMA_VERSION } from "./types";
export {
  applyDashboardCompatibilityMigrations,
  migratePersistedDashboardDocument,
  normalizeDashboardDocument,
  serializeDashboardSections,
} from "./document";
export {
  decodePanelInstance,
  ensureRuntimePanel,
  isRuntimePanelInstance,
  mergeRuntimePanelPatch,
  normalizePanelInstance,
} from "./normalize-panel";
export { normalizePanelBindings } from "@nexternel/domain";
export { normalizePanelScope, scopeConfigFromNormalized } from "./panel-scope";
export { isCorePanelType, migratePanelType } from "./panel-type";
export { serializePanelInstance } from "./serialize-panel";
export { runtimePanelToPanelInstance, toRenderPanel } from "./render-adapter";
export {
  hydrateDashboardPanels,
  hydrateSectionPanels,
  serializeDashboardDocumentV3,
  serializeSectionPanelsV3,
} from "./persistence";
export {
  normalizeSectionPanelsOnLoad,
  sectionPanelCount,
  sectionPanels,
  sectionWithPanels,
} from "./section-panels";
