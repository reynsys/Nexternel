import { registerCorePanelDescriptors } from "./core-descriptors";
import { registerEchartsPanelDescriptor } from "./echarts-descriptor";
import { registerGaugePanelDescriptor } from "./gauge-descriptor";

let bootstrapped = false;

/** Register core and built-in Panel descriptors into the V5 logical registry. */
export function bootstrapV5PanelRegistry(): void {
  if (bootstrapped) return;
  registerCorePanelDescriptors();
  registerEchartsPanelDescriptor();
  registerGaugePanelDescriptor();
  bootstrapped = true;
}

/** Test-only: re-register after `clearPanelRegistrations()`. */
export function rebootstrapV5PanelRegistry(): void {
  bootstrapped = false;
  bootstrapV5PanelRegistry();
}
