import { PANEL_GAUGE_TYPE } from "@nexternel/domain";
import type { PluginInfo } from "../api";
import { gaugePanelMeta, GaugeWidget } from "../widgets/gauge";
import { registerPanel } from "./registry";

/** Core bundled contribution panels — always available, not Plugins. */
export function loadCoreContributions() {
  registerPanel({ ...gaugePanelMeta, type: PANEL_GAUGE_TYPE, Component: GaugeWidget });
}

/** Register enabled plugin contributions from installed plugins. */
export function loadPluginContributions(_plugins: PluginInfo[]) {
  /* No built-in example plugins — user-installed plugins register via PluginHost when added. */
}

export function resetPluginContributions() {
  /* Built-in example plugins removed — nothing to unregister. */
}
