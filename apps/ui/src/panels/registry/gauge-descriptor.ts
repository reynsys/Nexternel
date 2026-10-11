import { PANEL_GAUGE_TYPE } from "@nexternel/domain";
import { registerPanelRegistration } from "./store";
import { sizingFromContribution } from "./sizing";
import type { PanelDescriptor, PanelImplementation } from "./types";

const GAUGE_DESCRIPTOR: PanelDescriptor = {
  type: PANEL_GAUGE_TYPE,
  label: "Gauge",
  description: "A dial for one sensor.",
  category: "sensors",
  source: "contribution",
  configSchemaVersion: 1,
  sizing: sizingFromContribution({ w: 4, h: 4 }, "radial-gauge"),
  responsive: {
    supportedStates: ["comfortable", "compact", "summary", "insufficient"],
  },
  accessibility: {
    label: "Gauge",
    role: "region",
  },
  userSelectable: true,
  sortOrder: 25,
  needsCapability: true,
  rendererClass: "radial-gauge",
};

const GAUGE_IMPLEMENTATION: PanelImplementation = {
  kind: "contribution",
  rendererClass: "radial-gauge",
};

/** Sizing + renderer class only — Component is attached by loadCoreContributions. */
export function registerGaugePanelDescriptor(): void {
  registerPanelRegistration(PANEL_GAUGE_TYPE, {
    descriptor: GAUGE_DESCRIPTOR,
    implementation: GAUGE_IMPLEMENTATION,
  });
}
