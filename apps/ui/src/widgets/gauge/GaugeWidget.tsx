import type { Capability, WidgetInstance } from "../../api";
import { VisualizationSlot } from "../../components/VisualizationSlot";
import { primaryCapabilityId } from "../../lib/widget-bindings";
import { EChartsHost } from "../echarts/EChartsHost";
import { EChartsWidgetBody } from "../echarts/EChartsWidgetBody";

type Props = {
  widget: WidgetInstance;
  capabilities: Capability[];
};

export function GaugeWidget({ widget, capabilities }: Props) {
  const capId = primaryCapabilityId(widget.bindings);
  const cap = capabilities.find((c) => c.id === capId);
  const dataLabel = cap?.name?.trim() ?? "";

  return (
    <VisualizationSlot>
      <EChartsHost>
        <EChartsWidgetBody
          widget={widget}
          cap={cap}
          dataLabel={dataLabel}
          tileTitle={null}
        />
      </EChartsHost>
    </VisualizationSlot>
  );
}
