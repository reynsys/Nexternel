import { createElement } from "react";
import { PANEL_GAUGE_TYPE } from "@nexternel/domain";
import type { PluginInfo, PluginPanelInfo } from "../api";
import { gaugePanelMeta, GaugeWidget } from "../widgets/gauge";
import { registerPanel } from "./registry";
import { unregisterContributionPanel } from "../panels/registry";
import { ConversationPanel } from "./blocks/ConversationPanel";
import { TextPanel } from "./blocks/TextPanel";

/** Core bundled contribution panels — always available, not Plugins. */
export function loadCoreContributions() {
  registerPanel({ ...gaugePanelMeta, type: PANEL_GAUGE_TYPE, Component: GaugeWidget });
}

let registeredPluginPanels: string[] = [];

// Same component for the same panel across refreshes, so open panels are not rebuilt.
const components = new Map<string, ReturnType<typeof makePanelComponent>>();

function panelComponent(pluginId: string, panel: PluginPanelInfo) {
  const key = JSON.stringify([pluginId, panel.id, panel.block, panel.label, panel.description ?? ""]);
  let component = components.get(key);
  if (!component) {
    component = makePanelComponent(pluginId, panel);
    components.set(key, component);
  }
  return component;
}

/** A plugin panel is drawn by one of Nexternel's building blocks, fed by the plugin. */
function makePanelComponent(pluginId: string, panel: PluginPanelInfo) {
  function PluginPanel({ widget }: { widget: { id: string } }) {
    return panel.block === "conversation"
      ? createElement(ConversationPanel, {
          pluginId,
          panelId: panel.id,
          instanceId: widget.id,
          placeholder: panel.description,
        })
      : createElement(TextPanel, { pluginId, panelId: panel.id, label: panel.label });
  }
  PluginPanel.displayName = `PluginPanel(${panel.type})`;
  return PluginPanel;
}

/** Register the panels of installed, switched-on plugins so they can be added to dashboards. */
export function loadPluginContributions(plugins: PluginInfo[]) {
  for (const p of plugins) {
    if (!p.enabled) continue;
    for (const panel of p.panels) {
      registerPanel({
        type: panel.type,
        label: panel.label,
        category: "plugins",
        needsCapability: false,
        defaultSize: panel.defaultSize ?? (panel.block === "conversation" ? { w: 4, h: 4 } : { w: 4, h: 3 }),
        rendererClass: "composite-tile",
        Component: panelComponent(p.id, panel),
        // Shown in Add panel under the plugin's name.
        ...({ description: panel.description ?? `From the ${p.name} plugin` } as object),
      });
      registeredPluginPanels.push(panel.type);
    }
  }
}

export function resetPluginContributions() {
  for (const type of registeredPluginPanels) unregisterContributionPanel(type);
  registeredPluginPanels = [];
}
