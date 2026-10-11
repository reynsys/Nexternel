import type { WidgetInstance } from "../api";
import { DeviceStatusWidget } from "../widgets/general/DeviceStatusWidget";
import { generalDefaultConfig } from "../widgets/general/config";

type Props = {
  config?: Record<string, unknown>;
  title?: string;
};

export function DevicesPanel({ config, title }: Props) {
  const widget: WidgetInstance = {
    id: "panel-devices",
    type: "device_status",
    title,
    layout: { i: "panel-devices", x: 0, y: 0, w: 4, h: 4 },
    bindings: {},
    config: { ...generalDefaultConfig("device_status"), ...(config ?? {}) },
  };
  return <DeviceStatusWidget widget={widget} />;
}
