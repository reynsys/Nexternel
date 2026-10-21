import type { PanelContentMode } from "@nexternel/domain";
import { normalizePanelKind } from "../lib/panel-kind";
import type { HistoryRange, ResolvedPanelCapability } from "../api";
import type {
  PanelAppearanceLayout,
  PanelItemDirection,
  PanelItemStyle,
} from "../lib/panel-appearance";
import { CameraPanel } from "./CameraPanel";
import { CalendarPanel } from "./CalendarPanel";
import { ClockPanel } from "./ClockPanel";
import { ChartsPanel } from "./ChartsPanel";
import { ControlsPanel } from "./ControlsPanel";
import { DevicesPanel } from "./DevicesPanel";
import { StatusPanel } from "./StatusPanel";
import { SystemPanel } from "./SystemPanel";
import { RoomsPanel } from "./RoomsPanel";
import { WeatherPanel } from "./WeatherPanel";

type Props = {
  panelKind: string;
  capabilities: ResolvedPanelCapability[];
  chartRange?: HistoryRange;
  chartPresetId?: string;
  chartMin?: number;
  chartMax?: number;
  panelLayout?: PanelAppearanceLayout;
  panelDirection?: PanelItemDirection;
  itemStyle?: PanelItemStyle;
  cameraAreaIds?: string[];
  cameraIds?: string[];
  cameraContentMode?: PanelContentMode;
  weatherConfig?: Record<string, unknown>;
  devicesConfig?: Record<string, unknown>;
  clockConfig?: Record<string, unknown>;
  /** Persisted dashboard tile title — never auto-filled from panel kind. */
  widgetTitle?: string | null;
};

export function PanelRenderer({
  panelKind,
  capabilities,
  chartRange,
  chartPresetId,
  chartMin,
  chartMax,
  panelLayout = "card",
  panelDirection = "across",
  itemStyle = "auto",
  cameraAreaIds,
  cameraIds,
  cameraContentMode,
  weatherConfig,
  devicesConfig,
  clockConfig,
  widgetTitle,
}: Props) {
  const kind = normalizePanelKind(panelKind);
  const title = widgetTitle?.trim() || undefined;

  switch (kind) {
    case "panel.controls":
      return (
        <ControlsPanel
          capabilities={capabilities}
          layout={panelLayout}
          direction={panelDirection}
          itemStyle={itemStyle}
        />
      );
    case "panel.charts":
      return (
        <ChartsPanel
          capabilities={capabilities}
          range={chartRange ?? "24h"}
          presetId={chartPresetId}
          chartMin={chartMin}
          chartMax={chartMax}
          layout={panelLayout}
          panelTitle={title}
        />
      );
    case "panel.camera":
      return (
        <CameraPanel
          areaIds={cameraAreaIds ?? []}
          cameraIds={cameraIds}
          contentMode={cameraContentMode}
          layout={panelLayout}
        />
      );
    case "panel.weather":
      return <WeatherPanel config={weatherConfig} title={title} />;
    case "panel.calendar":
      return <CalendarPanel title={title} />;
    case "panel.clock":
      return <ClockPanel title={title} config={clockConfig} />;
    case "panel.devices":
      return <DevicesPanel config={devicesConfig} title={title} />;
    case "panel.system":
      return <SystemPanel title={title} />;
    case "panel.rooms":
      return <RoomsPanel />;
    case "panel.status":
      return (
        <StatusPanel
          capabilities={capabilities}
          layout={panelLayout}
          direction={panelDirection}
          itemStyle={itemStyle}
        />
      );
    default:
      return null;
  }
}
