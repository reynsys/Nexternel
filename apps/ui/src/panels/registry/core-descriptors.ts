import { CORE_PANEL_REGISTRY } from "@nexternel/domain";

import type { PanelCategoryId } from "@nexternel/plugin-sdk";

import { registerPanelRegistration } from "./store";

import { sizingFromCoreDefinition } from "./sizing";

import type {

  PanelDescriptor,

  PanelImplementation,

  PanelImplementationKind,

  PanelRendererClass,

} from "./types";



function rendererForCoreKind(kind: string): {

  rendererClass: PanelRendererClass;

  implementationKind: PanelImplementationKind;

} {

  if (kind === "panel.controls") {

    return { rendererClass: "semantic-controls", implementationKind: "core-scoped" };

  }

  if (kind === "panel.status") {

    return { rendererClass: "semantic-readings", implementationKind: "core-scoped" };

  }

  if (kind === "panel.charts") {
    return { rendererClass: "time-series-chart", implementationKind: "specialised" };
  }

  if (kind === "panel.camera") {
    return { rendererClass: "live-media", implementationKind: "specialised" };
  }

  if (
    kind === "panel.weather" ||
    kind === "panel.calendar" ||
    kind === "panel.clock" ||
    kind === "panel.devices" ||
    kind === "panel.system" ||
    kind === "panel.rooms"
  ) {
    return { rendererClass: "composite-tile", implementationKind: "specialised" };
  }

  return { rendererClass: "semantic-readings", implementationKind: "core-scoped" };

}



function discoveryCategoryForCoreKind(kind: string): PanelCategoryId {

  switch (kind) {

    case "panel.controls":

      return "controls";

    case "panel.status":

      return "status";

    case "panel.charts":

      return "history";

    case "panel.camera":

      return "media";

    case "panel.weather":

    case "panel.calendar":
    case "panel.clock":
    case "panel.devices":
    case "panel.system":
    case "panel.rooms":
      return "system";

    default:

      return "status";

  }

}



export function registerCorePanelDescriptors(): void {

  for (const def of CORE_PANEL_REGISTRY) {

    const { rendererClass, implementationKind } = rendererForCoreKind(def.kind);

    const descriptor: PanelDescriptor = {

      type: def.kind,

      label: def.label,

      description: def.description,

      category: discoveryCategoryForCoreKind(def.kind),

      source: "core",

      configSchemaVersion: 1,

      scopeMode: def.scopeMode,

      // The device status list may be half height like other small panels.
      sizing: sizingFromCoreDefinition(def.defaultSize, def.kind === "panel.devices" ? "semantic-readings" : rendererClass),

      responsive: {

        supportedStates: ["comfortable", "compact", "summary", "insufficient"],

      },

      accessibility: {

        label: def.label,

        description: def.description,

        role: "region",

      },

      userSelectable: def.userSelectable,

      previewOnly: def.previewOnly,

      sortOrder: def.sortOrder,

      needsCapability: def.scopeMode === "capabilities",

      rendererClass,

    };



    const implementation: PanelImplementation = {

      kind: implementationKind,

      rendererClass,

    };



    registerPanelRegistration(def.kind, {

      descriptor,

      implementation,

    });

  }

}


