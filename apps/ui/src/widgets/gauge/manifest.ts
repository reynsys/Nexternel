import { PANEL_GAUGE_TYPE } from "@nexternel/domain";
import type { PanelBindingSlotDef } from "@nexternel/plugin-sdk";

export const GAUGE_WIDGET_TYPE = PANEL_GAUGE_TYPE;

export const GAUGE_BINDING_SLOTS: PanelBindingSlotDef[] = [
  {
    key: "primary",
    label: "Sensor",
    kinds: [
      "temperature",
      "humidity",
      "pressure",
      "battery",
      "voltage",
      "current",
      "power",
      "energy",
      "co2",
      "pm1",
      "pm25",
      "pm10",
      "number",
    ],
    required: true,
  },
];

export const gaugePanelMeta = {
  type: GAUGE_WIDGET_TYPE,
  label: "Gauge",
  description: "Live dial for a sensor reading.",
  category: "sensors" as const,
  needsCapability: false,
  bindingSlots: GAUGE_BINDING_SLOTS,
  defaultSize: { w: 4, h: 4 },
  rendererClass: "radial-gauge" as const,
  /** Between Status (20) and Charts (30) in Add Panel. */
  sortOrder: 25,
};
