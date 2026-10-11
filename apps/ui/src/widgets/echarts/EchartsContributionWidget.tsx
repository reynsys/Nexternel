import type { Capability, WidgetInstance } from "../../api";
import { VisualizationSlot } from "../../components/VisualizationSlot";
import { primaryCapabilityId } from "../../lib/widget-bindings";
import { migrateWidgetToEcharts } from "./config";
import { EChartsHost } from "./EChartsHost";
import { EChartsWidgetBody } from "./EChartsWidgetBody";

type Props = {
  widget: WidgetInstance;
  capabilities: Capability[];
};

/** Standalone ECharts panels (history charts, live diagrams, gauges) on the dashboard. */
export function EchartsContributionWidget({
  widget,
  capabilities,
}: Props) {
  const migrated = migrateWidgetToEcharts(widget);
  const capId = primaryCapabilityId(migrated.bindings);
  const cap = capabilities.find((c) => c.id === capId);
  const dataLabel = cap?.name?.trim() ?? "";

  return (
    <VisualizationSlot>
      <EChartsHost>
        <EChartsWidgetBody
          widget={migrated}
          cap={cap}
          dataLabel={dataLabel}
          tileTitle={null}
        />
      </EChartsHost>
    </VisualizationSlot>
  );
}
