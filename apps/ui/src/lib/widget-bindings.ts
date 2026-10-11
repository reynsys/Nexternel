/**
 * Panel capability bindings — authoritative definition lives in `@nexternel/domain`.
 * Do not add binding schema or normalization rules here.
 */
export type { PanelBindings, WidgetBindings } from "@nexternel/domain";
export {
  WidgetBindingsSchema,
  allCapabilityIds,
  bindingsFromSlots,
  deviceIdsFromBindings,
  getBindingSlot,
  mergeBindingSlots,
  normalizePanelBindings,
  parseWidgetBindings,
  primaryCapabilityId,
} from "@nexternel/domain";
