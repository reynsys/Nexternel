/** Human-readable ECharts series families (aligned with Apache ECharts chart types). */
export type EchartsFamilyMeta = {
  id: string;
  label: string;
  /** One-line hint shown in dropdowns */
  hint: string;
};

export const ECHARTS_FAMILY_META: EchartsFamilyMeta[] = [
  {
    id: "gauge",
    label: "Gauge",
    hint: "Live dial for a sensor reading",
  },
  {
    id: "line",
    label: "Line",
    hint: "Time-series line from history",
  },
  {
    id: "area",
    label: "Area",
    hint: "Filled / stacked area from history",
  },
  {
    id: "bar",
    label: "Bar",
    hint: "Vertical or horizontal bars from history",
  },
  {
    id: "pie",
    label: "Pie",
    hint: "Pie, doughnut, or rose",
  },
  {
    id: "scatter",
    label: "Scatter",
    hint: "Points over time from history",
  },
  {
    id: "radar",
    label: "Radar",
    hint: "Multi-axis live snapshot",
  },
  {
    id: "funnel",
    label: "Funnel",
    hint: "Stage funnel from live value",
  },
  {
    id: "heatmap",
    label: "Heatmap",
    hint: "Hour × weekday intensity from history",
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Blank shell — Advanced JSON only",
  },
];

const BY_ID = new Map(ECHARTS_FAMILY_META.map((f) => [f.id, f]));

export function getEchartsFamilyMeta(familyId: string): EchartsFamilyMeta {
  return (
    BY_ID.get(familyId) ?? {
      id: familyId,
      label: familyId,
      hint: "",
    }
  );
}

export function listEchartsFamilyMeta(): EchartsFamilyMeta[] {
  return ECHARTS_FAMILY_META;
}
