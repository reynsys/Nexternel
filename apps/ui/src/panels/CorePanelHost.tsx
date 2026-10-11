import { useMemo } from "react";
import { CircularProgress, Typography } from "@mui/material";
import { PanelTile } from "../components/PanelTile";
import { runtimeConfigToPanelRecord } from "../lib/panel-compatibility/panel-config";
import type { RuntimePanelInstance } from "../lib/panel-compatibility/types";
import { effectivePanelScope } from "../lib/panel-scope";
import {
  readPanelChartMinMax,
  readPanelChartPreset,
  readPanelChartRange,
} from "../lib/panel-chart-config";
import {
  readPanelAppearanceLayout,
  readPanelItemDirection,
  readPanelItemStyle,
} from "../lib/panel-appearance";
import {
  isIntegrationPanelKind,
  readPanelDevicesConfig,
  readPanelWeatherConfig,
} from "../lib/panel-integration";
import { normalizePanelKind } from "../lib/panel-kind";
import { PanelResponsiveSurface } from "./responsive";
import { useDashboardTileChrome } from "../lib/dashboard-tile-context";
import { PanelRenderer } from "./PanelRenderer";
import { useResolvedPanel } from "./useResolvedPanel";

type Props = {
  panel: RuntimePanelInstance;
  sectionRoomId?: string | null;
};

/** Core scoped/integration Panel content — orchestrated by PanelHost. */
export function CorePanelHost({ panel, sectionRoomId }: Props) {
  const { titleTile } = useDashboardTileChrome();
  const scopeConfig = panel.config.scope;
  const dataConfig = useMemo(
    () => runtimeConfigToPanelRecord(panel.config),
    [panel.config]
  );
  const panelKind = normalizePanelKind(panel.type);
  const resolvedScope = useMemo(
    () => effectivePanelScope(scopeConfig, sectionRoomId ?? null),
    [scopeConfig, sectionRoomId]
  );
  const { capabilities, loading, error } = useResolvedPanel(
    panelKind,
    scopeConfig,
    sectionRoomId ?? null
  );
  const chartRange = readPanelChartRange(dataConfig);
  const chartPresetId = readPanelChartPreset(dataConfig);
  const { min: chartMin, max: chartMax } = readPanelChartMinMax(dataConfig);
  const appearanceLayout = readPanelAppearanceLayout(dataConfig);
  const panelDirection = readPanelItemDirection(dataConfig);
  const itemStyle = readPanelItemStyle(dataConfig);
  const weatherConfig = readPanelWeatherConfig(dataConfig);
  const devicesConfig = readPanelDevicesConfig(dataConfig);
  /** Same strings as the title tile — used so chart bodies do not repeat the name. */
  const title = titleTile?.title?.trim() || null;
  const isIntegration = isIntegrationPanelKind(panelKind);
  const isCamera = panelKind === "panel.camera";
  const directRender = isIntegration || isCamera;
  if (directRender) {
    return (
      <PanelResponsiveSurface panelType={panelKind}>
        <PanelRenderer
          panelKind={panelKind}
          capabilities={[]}
          cameraAreaIds={resolvedScope.areaIds}
          cameraIds={resolvedScope.cameraIds}
          cameraContentMode={resolvedScope.contentMode}
          weatherConfig={weatherConfig}
          devicesConfig={devicesConfig}
          clockConfig={dataConfig}
          widgetTitle={title}
          panelLayout={appearanceLayout}
          panelDirection={panelDirection}
        />
      </PanelResponsiveSurface>
    );
  }

  if (loading) {
    return (
      <PanelTile sx={{ alignItems: "center", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </PanelTile>
    );
  }

  if (error) {
    return (
      <PanelTile sx={{ p: 1.5 }}>
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      </PanelTile>
    );
  }

  return (
    <PanelResponsiveSurface panelType={panelKind}>
      <PanelRenderer
        panelKind={panelKind}
        capabilities={capabilities}
        chartRange={chartRange}
        chartPresetId={chartPresetId}
        chartMin={chartMin}
        chartMax={chartMax}
        panelLayout={appearanceLayout}
        panelDirection={panelDirection}
        itemStyle={itemStyle}
        widgetTitle={title}
      />
    </PanelResponsiveSurface>
  );
}
