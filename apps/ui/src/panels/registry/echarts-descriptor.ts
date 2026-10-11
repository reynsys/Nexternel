import { registerPanelRegistration } from "./store";
import { sizingFromContribution } from "./sizing";
import type { PanelDescriptor, PanelImplementation } from "./types";

const ECHARTS_DESCRIPTOR: PanelDescriptor = {
  type: "echarts",
  label: "Chart",
  description: "ECharts gauge or history visualisation.",
  category: "history",
  source: "echarts",
  configSchemaVersion: 1,
  sizing: sizingFromContribution({ w: 8, h: 4 }, "chart-canvas"),
  responsive: {
    supportedStates: ["comfortable", "compact", "summary", "insufficient"],
  },
  accessibility: {
    label: "Chart panel",
    role: "region",
  },
  userSelectable: false,
  sortOrder: 500,
  needsCapability: true,
  rendererClass: "chart-canvas",
};

const ECHARTS_IMPLEMENTATION: PanelImplementation = {
  kind: "echarts",
  rendererClass: "chart-canvas",
};

export function registerEchartsPanelDescriptor(): void {
  registerPanelRegistration("echarts", {
    descriptor: ECHARTS_DESCRIPTOR,
    implementation: ECHARTS_IMPLEMENTATION,
  });
}
