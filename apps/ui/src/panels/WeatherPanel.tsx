import type { WidgetInstance } from "../api";
import { WeatherWidget } from "../widgets/general/WeatherWidget";
import { generalDefaultConfig } from "../widgets/general/config";

type Props = {
  config?: Record<string, unknown>;
  title?: string;
};

export function WeatherPanel({ config, title }: Props) {
  const widget: WidgetInstance = {
    id: "panel-weather",
    type: "weather",
    title,
    layout: { i: "panel-weather", x: 0, y: 0, w: 8, h: 4 },
    bindings: {},
    config: { ...generalDefaultConfig("weather"), ...(config ?? {}) },
  };
  return <WeatherWidget widget={widget} />;
}
