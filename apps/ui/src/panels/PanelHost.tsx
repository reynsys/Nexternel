import { type ReactNode } from "react";
import { Stack, Typography } from "@mui/material";
import { isPluginPanelType } from "@nexternel/domain";
import type { Capability } from "../api";
import { api } from "../api";
import { DashboardTileBody } from "../components/DashboardTileBody";
import { PanelTile } from "../components/PanelTile";
import { normalizePanelKind } from "../lib/panel-kind";

/** Kinds whose body renders one tile per reading, switch, chart, or camera. */
const MULTI_ITEM_PANEL_KINDS = new Set([
  "panel.status",
  "panel.controls",
  "panel.charts",
  "panel.camera",
]);
import { useDashboardTileChrome } from "../lib/dashboard-tile-context";
import { toRenderPanel } from "../lib/panel-compatibility/render-adapter";
import type { RuntimePanelInstance } from "../lib/panel-compatibility/types";
import { usePanelSize } from "../lib/panel-size-context";
import { allCapabilityIds } from "../lib/widget-bindings";
import {
  panelActivityIsActive,
  useCapabilitiesWithLiveState,
  useDashboardDataRuntime,
  type PanelActivity,
} from "../lib/dashboard-data-runtime";
import { usePluginHostOptional } from "../plugins/PluginHostContext";
import { PluginUnavailable } from "../plugins/PluginUnavailable";
import { EchartsContributionWidget } from "../widgets/echarts/EchartsContributionWidget";
import { CorePanelHost } from "./CorePanelHost";
import { PanelUnavailable } from "./PanelUnavailable";
import { PanelResponsiveProvider, resolvePanelResponsiveState } from "./responsive";
import { resolvePanelRegistration, type ResolvedPanelRegistration } from "./registry";

export type PanelHostProps = {
  panel: RuntimePanelInstance;
  capabilities: Capability[];
  editMode: boolean;
  sectionRoomId?: string | null;
  activity?: PanelActivity;
  onCapabilityState?: (
    capabilityId: string,
    value: unknown,
    quality?: string,
    updatedAt?: string
  ) => void;
};

type PanelHostBodyProps = {
  panel: RuntimePanelInstance;
  contributionWidget: ReturnType<typeof toRenderPanel>;
  resolved: ResolvedPanelRegistration;
  capabilities: Capability[];
  editMode: boolean;
  sectionRoomId?: string | null;
  activity?: PanelActivity;
  onCapabilityState?: (
    capabilityId: string,
    value: unknown,
    quality?: string,
    updatedAt?: string
  ) => void;
};

function PanelHostBody({
  panel,
  contributionWidget,
  resolved,
  capabilities,
  editMode,
  sectionRoomId,
  onCapabilityState,
  activity = "visible",
}: PanelHostBodyProps) {
  const { showBodyHeading } = useDashboardTileChrome();
  const pluginHost = usePluginHostOptional();
  const runtime = useDashboardDataRuntime();
  const panelSize = usePanelSize();
  const responsiveState = resolvePanelResponsiveState(
    panelSize,
    resolved.descriptor?.sizing ?? {
      minWidth: 2,
      minHeight: 2,
      degradationModes: ["comfortable", "compact", "summary", "insufficient"],
    }
  );

  const needsLiveCapabilities =
    resolved.implementation?.kind === "contribution" ||
    resolved.implementation?.kind === "echarts";
  const capabilityIds = needsLiveCapabilities
    ? allCapabilityIds(panel.bindings)
    : [];
  const liveCapabilities = useCapabilitiesWithLiveState(
    capabilities,
    capabilityIds,
    activity
  );

  /**
   * Panels that list several items draw one tile per item themselves (PanelItemChrome).
   * Every other panel — and every unavailable / error state — sits in exactly one tile.
   */
  const tilesPerItem =
    resolved.availability === "available" &&
    MULTI_ITEM_PANEL_KINDS.has(normalizePanelKind(panel.type));
  const wrap = (body: ReactNode) => (
    <PanelResponsiveProvider
      value={{
        state: responsiveState,
        contentWidth: panelSize.width,
        contentHeight: panelSize.height,
      }}
    >
      {tilesPerItem ? body : <PanelTile>{body}</PanelTile>}
    </PanelResponsiveProvider>
  );

  if (resolved.availability === "plugin_missing" && isPluginPanelType(panel.type)) {
    const record = pluginHost?.plugins.find((p) =>
      p.panels.some((t) => t === panel.type || t === panel.compatibility.sourceType)
    );
    return wrap(
      <PluginUnavailable
        pluginId={record?.id}
        pluginName={record?.name}
        reason={record && !record.enabled ? "disabled" : "missing"}
      />
    );
  }

  if (resolved.availability !== "available") {
    return wrap(
      <PanelUnavailable
        panelType={panel.compatibility.sourceType || panel.type}
        availability={resolved.availability}
        configErrors={resolved.configErrors}
      />
    );
  }

  const kind = resolved.implementation?.kind;

  if (kind === "core-scoped" || kind === "specialised") {
    return wrap(
      <CorePanelHost
        panel={panel}
        sectionRoomId={sectionRoomId}
      />
    );
  }

  if (kind === "echarts") {
    return wrap(
      <EchartsContributionWidget widget={contributionWidget} capabilities={liveCapabilities} />
    );
  }

  if (kind === "contribution") {
    const ContributionComponent = resolved.implementation?.Component;
    if (!ContributionComponent) {
      return wrap(
        <PanelUnavailable panelType={panel.type} availability="unknown" />
      );
    }

    return wrap(
      <ContributionComponent
        widget={contributionWidget}
        capabilities={liveCapabilities}
        editMode={editMode}
        showBodyHeading={showBodyHeading}
        onCapabilityCommand={async (capabilityId: string, action: "on" | "off") => {
          const res = await api.command(capabilityId, action);
          const updatedAt = new Date().toISOString();
          runtime.applyCapabilityState({
            capabilityId,
            value: res.value,
            quality: "good",
            updatedAt,
          });
          onCapabilityState?.(capabilityId, res.value, "good", updatedAt);
          return res;
        }}
      />
    );
  }

  return wrap(
    <Stack height="100%" justifyContent="center" sx={{ px: 1 }}>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Unsupported panel. Remove it from the dashboard.
      </Typography>
    </Stack>
  );
}

/**
 * V5 PanelHost — single lifecycle orchestrator for Dashboard Panels (LAW 005).
 */
export function PanelHost({
  panel,
  capabilities,
  editMode,
  sectionRoomId,
  activity = "visible",
  onCapabilityState,
}: PanelHostProps) {
  const contributionWidget = toRenderPanel(panel);
  const resolved = resolvePanelRegistration(panel);

  if (!panelActivityIsActive(activity)) return null;

  return (
    <DashboardTileBody widgetId={panel.id} widgetType={panel.type}>
      <PanelHostBody
        panel={panel}
        contributionWidget={contributionWidget}
        resolved={resolved}
        capabilities={capabilities}
        editMode={editMode}
        sectionRoomId={sectionRoomId}
        activity={activity}
        onCapabilityState={onCapabilityState}
      />
    </DashboardTileBody>
  );
}
