import type { WidgetInstance } from "../api";
import { CalendarWidget } from "../widgets/general/CalendarWidget";

type Props = {
  title?: string;
};

export function CalendarPanel({ title }: Props) {
  const widget: WidgetInstance = {
    id: "panel-calendar",
    type: "calendar",
    title,
    layout: { i: "panel-calendar", x: 0, y: 0, w: 5, h: 7 },
    bindings: {},
    config: {},
  };
  return <CalendarWidget widget={widget} />;
}
