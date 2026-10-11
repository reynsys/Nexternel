import type { WidgetInstance } from "../api";
import { SystemInfoWidget } from "../widgets/general/SystemInfoWidget";

type Props = {
  title?: string;
};

export function SystemPanel({ title }: Props) {
  const widget: WidgetInstance = {
    id: "panel-system",
    type: "system_info",
    title,
    layout: { i: "panel-system", x: 0, y: 0, w: 8, h: 4 },
    bindings: {},
    config: {},
  };
  return <SystemInfoWidget widget={widget} />;
}
