import type { ReactNode } from "react";
import { Box, Paper } from "@mui/material";
import { readPanelStatusLight } from "@nexternel/domain";
import type { CameraRecord, Capability } from "../api";
import type { RuntimePanelInstance } from "../lib/panel-compatibility/types";
import { runtimeConfigToPanelRecord } from "../lib/panel-compatibility/panel-config";
import { PanelHost } from "../panels/PanelHost";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { DashboardTileContext } from "../lib/dashboard-tile-context";
import { readPanelItemDisplay } from "../lib/panel-item-display";
import { panelTitleIcon } from "../lib/panel-title-icon";
import { ItemIcon } from "../lib/icons/ItemIcon";
import { chartRangeLabel, readPanelChartRange } from "../lib/panel-chart-config";
import { normalizePanelKind } from "../lib/panel-kind";
import {
  PANEL_TITLE_AREA_LINE_PX,
  PANEL_TITLE_NAME_LINE_PX,
  PANEL_TITLE_TILE_HEIGHT,
  panelHeading,
  panelTitleAreaSx,
  panelTitleNameSx,
  panelTitleRangeSx,
} from "../lib/panel-heading";
import { contentSurfaceSx } from "../skins/surfaceStyles";
import { useGradientActive, useSolidContentPanels } from "../skins/useSurfaceStyles";
import { LookDecor } from "../skins/looks/LookDecor";
import { readPanelSwitchStyle } from "../lib/switch-styles";
import { readPanelMotion } from "../lib/motion";
import type { PanelActivity } from "../lib/dashboard-data-runtime";
import { StatusLight, lightPlacement, resolveStatusLook, useGlowEdgeSx, useStatusLightPrefs } from "./status-light/StatusLight";

/** Grabbing a panel's title moves it while the dashboard is being arranged. */
export const PANEL_DRAG_HANDLE = "nx-panel-drag-handle";
/** Parts of the title that are buttons, not a place to grab. */
export const PANEL_NO_DRAG = "nx-panel-no-drag";

/** One title tile for every panel — same row heights and typography everywhere. */
function PanelTitleTile({
  tileTitle,
  areaLabel,
  rangeNote,
  isChartsPanel,
  icon,
  light,
  actions,
}: {
  /** Status light for the panel's only reading (inline at the right, or a bar along the bottom). */
  light?: ReactNode;
  /** While arranging the dashboard: the panel's Edit / More buttons; the title itself is the drag handle. */
  actions?: ReactNode;
  tileTitle: string | null;
  areaLabel: string | null;
  rangeNote: string | null;
  isChartsPanel: boolean;
  /** Title bar icon (panel-title-icon.ts); iconId null = none. */
  icon: { iconId: string | null; kind: string | null };
}) {
  const titleLine = tileTitle?.trim() || null;
  const areaLine = areaLabel?.trim() || null;
  const showAreaRow = Boolean(areaLine || (isChartsPanel && rangeNote));

  return (
    <Box
      data-nx-title-tile
      className={actions ? PANEL_DRAG_HANDLE : undefined}
      title={actions ? "Drag to move this panel" : undefined}
      sx={{
        ...(actions ? { cursor: "grab", touchAction: "none", "&:active": { cursor: "grabbing" } } : {}),
        flexShrink: 0,
        height: PANEL_TITLE_TILE_HEIGHT,
        minHeight: PANEL_TITLE_TILE_HEIGHT,
        maxHeight: PANEL_TITLE_TILE_HEIGHT,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "6px",
        minWidth: 0,
        px: "var(--nx-title-inset, 8px)",
        overflow: "hidden",
        position: "relative",
        // Status lights get smaller in a narrow title (container queries in StatusLight).
        containerType: "inline-size",
        containerName: "nx-title",
      }}
    >
      {icon.iconId !== null ? (
        <ItemIcon iconId={icon.iconId} kind={icon.kind} sx={{ fontSize: 18, flexShrink: 0, color: "primary.main" }} />
      ) : null}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          rowGap: 0,
          gap: 0,
          flex: 1,
          width: "100%",
          minWidth: 0,
          "& > *": { margin: 0, padding: 0 },
        }}
      >
      {titleLine ? (
        <Box
          component="div"
          title={titleLine}
          sx={{ ...panelTitleNameSx, height: `${PANEL_TITLE_NAME_LINE_PX}px` }}
        >
          {titleLine}
        </Box>
      ) : null}
      {showAreaRow ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            height: `${PANEL_TITLE_AREA_LINE_PX}px`,
            width: "100%",
            gap: "8px",
          }}
        >
          {areaLine ? (
            <Box
              component="div"
              title={areaLine}
              sx={{
                ...panelTitleAreaSx,
                flex: 1,
                minWidth: 0,
                width: "auto",
              }}
            >
              {areaLine}
            </Box>
          ) : (
            <Box sx={{ flex: 1, minWidth: 0 }} />
          )}
          {isChartsPanel && rangeNote ? (
            <Box
              component="div"
              title={rangeNote}
              sx={{ ...panelTitleRangeSx, color: "text.secondary", m: 0 }}
            >
              {rangeNote}
            </Box>
          ) : null}
        </Box>
      ) : null}
      </Box>
      {light}
      {actions ? (
        <Box className={PANEL_NO_DRAG} sx={{ display: "flex", gap: "var(--nx-control-gap)", flexShrink: 0, cursor: "default" }}>
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}

type PanelCardProps = {
  panel: RuntimePanelInstance;
  capabilities: Capability[];
  cameras?: CameraRecord[];
  sectionRoomId?: string | null;
  editMode?: boolean;
  activity?: PanelActivity;
  onCapabilityState?: (capabilityId: string, value: unknown, quality?: string, updatedAt?: string) => void;
  /** While arranging the dashboard: the panel's buttons, in its title (the title is then the drag handle). */
  editActions?: ReactNode;
  /** Name shown in the title while arranging when the panel has none of its own (e.g. "Clock"). */
  editFallbackTitle?: string;
};

/**
 * One dashboard panel: frame, title tile, status light and body. The dashboard grid and the
 * Edit menu's preview both draw panels with this, so the preview is exactly what the dashboard shows.
 */
export function PanelCard({
  panel: w,
  capabilities,
  cameras,
  sectionRoomId,
  editMode = false,
  activity,
  onCapabilityState,
  editActions,
  editFallbackTitle,
}: PanelCardProps) {
  const gradientActive = useGradientActive();
  const solidContentPanels = useSolidContentPanels();
  const switchStyle = readPanelSwitchStyle(runtimeConfigToPanelRecord(w.config));
  const motion = readPanelMotion(runtimeConfigToPanelRecord(w.config));
  const statusPrefs = useStatusLightPrefs();
  const heading = panelHeading(w, capabilities, sectionRoomId, cameras);
  // While arranging, every panel shows its name, so each one can be told apart and grabbed.
  const tileTitle = heading.title ?? (editActions ? editFallbackTitle ?? null : null);
  const areaLabel = heading.area;
  const rangeNote =
    normalizePanelKind(w.type) === "panel.charts"
      ? chartRangeLabel(readPanelChartRange(runtimeConfigToPanelRecord(w.config)))
      : null;
  const showTitleTile = Boolean(tileTitle || areaLabel || rangeNote || editActions);
  const isChartsPanel = normalizePanelKind(w.type) === "panel.charts";
  const titleIcon = panelTitleIcon(w.type, runtimeConfigToPanelRecord(w.config), heading);
  // Lights belong to readings: a panel with one reading shows it here; a panel with
  // several draws one per reading in its mini panels (PanelItemChrome).
  const statusLook = resolveStatusLook(
    readPanelStatusLight(runtimeConfigToPanelRecord(w.config)),
    statusPrefs
  );
  const lightCap = heading.item ?? null;
  const titlePlacement = lightCap && showTitleTile ? lightPlacement(statusLook, "title") : null;
  const readingPlacement = lightCap ? lightPlacement(statusLook, "reading") : null;
  // A lit glowing border round the whole panel: the panel's own edge takes the colour.
  const glowEdgeSx = useGlowEdgeSx(lightCap?.id, lightCap?.kind, statusLook, titlePlacement === "frame");
  const lightAt = (placement: ReturnType<typeof lightPlacement>, edge: "panel" | "box" = "box") =>
    placement && lightCap ? (
      <StatusLight
        capabilityId={lightCap.id}
        kind={lightCap.kind}
        unit={lightCap.unit}
        look={statusLook}
        placement={placement}
        // The title light's glowing border goes round the whole panel; the reading's round its tile.
        edge={edge}
      />
    ) : null;
  return (
    <Paper
      // This panel's own Animations choice (absent = follows Settings → Appearance).
      data-nx-panel-motion={motion === "follow" ? undefined : motion}
      elevation={0}
      variant="outlined"
      sx={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
        // The Look's panel shape (skins/looks): corners, border and shadow.
        borderRadius: "var(--nx-panel-radius, 20px)",
        border: "var(--nx-panel-border, 1px solid rgba(255,255,255,0.12))",
        boxShadow: "var(--nx-panel-shadow, none)",
        position: "relative",
        ...contentSurfaceSx(gradientActive, solidContentPanels),
        // A Look may give panels their own fill (not over frosted glass).
        ...(gradientActive && !solidContentPanels ? {} : { backgroundColor: "var(--nx-panel-fill, var(--nx-surface-paper))" }),
        ...glowEdgeSx,
      }}
    >
      <LookDecor slot="panel" />
      {titlePlacement === "frame" ? lightAt("frame", "panel") : null}
      <Box
        data-nx-panel-body
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          p: "var(--nx-panel-inset, 4px)",
          gap: showTitleTile ? "6px" : 0,
          overflow: "hidden",
          // Above the Look's panel frame.
          position: "relative",
          zIndex: 1,
        }}
      >
        {showTitleTile ? (
          <PanelTitleTile
            tileTitle={tileTitle}
            areaLabel={areaLabel}
            rangeNote={rangeNote}
            isChartsPanel={isChartsPanel}
            icon={titleIcon}
            light={titlePlacement === "inline" ? lightAt("inline") : null}
            actions={editActions}
          />
        ) : null}
        {titlePlacement === "under-title" ? lightAt("gap-bar") : null}
        <Box
          data-nx-main-tile
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            borderRadius: "var(--nx-main-tile-radius, 15px)",
          }}
        >
          {lightAt(readingPlacement)}
          <DashboardTileContext.Provider
            value={{
              showBodyHeading: false,
              showItemContext: areaLabel == null,
              showItemLabel: !heading.ownsItemName,
              titleTile: { ...heading, rangeNote },
              itemDisplay: readPanelItemDisplay(runtimeConfigToPanelRecord(w.config)),
              statusLook,
              switchStyle,
            }}
          >
            <WidgetErrorBoundary widgetId={w.id} widgetType={w.type} resetKey={`${w.type}:${JSON.stringify(w.config ?? {})}`}>
              <PanelHost
                panel={w}
                capabilities={capabilities}
                editMode={editMode}
                sectionRoomId={sectionRoomId}
                activity={activity}
                onCapabilityState={onCapabilityState}
              />
            </WidgetErrorBoundary>
          </DashboardTileContext.Provider>
        </Box>
      </Box>
    </Paper>
  );
}
