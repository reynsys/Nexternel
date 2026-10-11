import type { WidgetInstance } from "../api";
import { ClockWidget } from "../widgets/general/ClockWidget";

type Props = {
  title?: string;
  config?: Record<string, unknown>;
};

export function ClockPanel({ title, config }: Props) {
  const widget: WidgetInstance = {
    id: "panel-clock",
    type: "clock",
    title,
    layout: { i: "panel-clock", x: 0, y: 0, w: 4, h: 4 },
    bindings: {},
    config: config ?? {},
  };
  return <ClockWidget widget={widget} />;
}
