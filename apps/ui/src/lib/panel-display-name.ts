import { bootstrapV5PanelRegistry, getPanelDescriptor } from "../panels/registry";
import { panelLabel } from "../widgets/panel";

/** User-facing panel name — never expose registry type ids in normal UI. */
export function panelDisplayName(panelType: string): string {
  bootstrapV5PanelRegistry();
  const descriptor = getPanelDescriptor(panelType);
  if (descriptor?.label) return descriptor.label;
  return panelLabel(panelType);
}
