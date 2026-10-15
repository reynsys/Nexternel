import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TuneIcon from "@mui/icons-material/Tune";
import type { CameraRecord, Capability, PanelInstance } from "../api";
import type { RuntimePanelInstance } from "../lib/panel-compatibility/types";
import { runtimeConfigToPanelRecord } from "../lib/panel-compatibility/panel-config";
import { toRenderPanel } from "../lib/panel-compatibility/render-adapter";
import { PanelHost } from "../panels/PanelHost";
import { flowCommit, flowGridForWidth, flowLayout } from "../panels/flow-layout";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";
import { PanelWidgetEditor, isPanelWidgetType, panelLabel } from "../widgets/panel";
import { GAUGE_WIDGET_TYPE } from "../widgets/gauge";
import { EChartsWidgetEditor } from "../widgets/echarts/EChartsWidgetEditor";
import { isEchartsWidgetType } from "../widgets/echarts/config";
import { getPanelContribution } from "../plugins/registry";
import { DashboardTileContext } from "../lib/dashboard-tile-context";
import { readPanelItemDisplay } from "../lib/panel-item-display";
import { panelTitleIcon } from "../lib/panel-title-icon";
import type { AutomaticTitle } from "./PanelTitleFields";
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
import {
  panelAsGeneralWidget,
  resolveDashboardEditorKind,
} from "../lib/panel-editor-route";
import { GeneralWidgetEditor } from "../widgets/GeneralWidgetEditor";
import { migrateContributionPanelType, isPluginPanelType, readPanelStatusLight } from "@nexternel/domain";
import {
  StatusLight,
  lightPlacement,
  resolveStatusLook,
  useStatusLightPrefs,
} from "./status-light/StatusLight";
import {
  DASHBOARD_GRID_MARGIN_X,
  DASHBOARD_GRID_MARGIN_Y,
} from "../panels/grid-geometry";
import {
  clampSectionLayout,
  gridLayoutItemForPanel,
  gridLayoutsEqual,
  panelSectionLayoutMatches,
} from "../panels/placement";
import { contentSurfaceSx } from "../skins/surfaceStyles";
import { useGradientActive, useSolidContentPanels } from "../skins/useSurfaceStyles";
import { useConfirm } from "./confirm";
import type { PanelActivity } from "../lib/dashboard-data-runtime";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const PANEL_DRAG_MIME = "application/x-nexternel-panel";

/** One title tile for every panel — same row heights and typography everywhere. */
function PanelTitleTile({
  tileTitle,
  areaLabel,
  rangeNote,
  isChartsPanel,
  icon,
  light,
}: {
  /** Status light for the panel's only reading (inline at the right, or a bar along the bottom). */
  light?: ReactNode;
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
      sx={{
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
        px: "8px",
        overflow: "hidden",
        position: "relative",
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
    </Box>
  );
}

type Props = {
  sectionId: string;
  sectionRoomId?: string | null;
  sectionTitle?: string;
  panels: RuntimePanelInstance[];
  capabilities: Capability[];
  /** Every camera, so camera panels can name their title strip like other panels. */
  cameras?: CameraRecord[];
  editMode: boolean;
  activity?: PanelActivity;
  onLayoutChange: (sectionId: string, next: Layout[]) => void;
  onRemovePanel: (sectionId: string, panelId: string) => void;
  /** Editors send saved-format changes; the dashboard decodes them into the runtime panel. */
  onUpdatePanel: (
    sectionId: string,
    panelId: string,
    patch: Partial<PanelInstance>
  ) => void;
  onMovePanel?: (fromSectionId: string, toSectionId: string, panelId: string) => void;
  panelDrag?: { panelId: string; fromSectionId: string } | null;
  onPanelDragStart?: (sectionId: string, panelId: string) => void;
  onPanelDragEnd?: () => void;
  onCapabilityState?: (
    capabilityId: string,
    value: unknown,
    quality?: string,
    updatedAt?: string
  ) => void;
};

function widgetTypeLabel(type: string): string {
  const migrated = migrateContributionPanelType(type);
  if (isPanelWidgetType(migrated)) return panelLabel(migrated);
  if (migrated === GAUGE_WIDGET_TYPE || isEchartsWidgetType(migrated)) return "Gauge";
  return getPanelContribution(migrated)?.label ?? type;
}

function dashboardItemKind(type: string): "panel" | "plugin" {
  const migrated = migrateContributionPanelType(type);
  return isPluginPanelType(migrated) ? "plugin" : "panel";
}

function isEditableWidget(widget: RuntimePanelInstance): boolean {
  return resolveDashboardEditorKind(widget) !== null;
}

/**
 * RGL inside accordion/collapse needs measured width — WidthProvider often stays at 0.
 */
export function SectionGrid({
  sectionId,
  sectionRoomId,
  sectionTitle,
  panels,
  capabilities,
  cameras = [],
  editMode,
  activity = "visible",
  onLayoutChange,
  onRemovePanel,
  onUpdatePanel,
  onMovePanel,
  panelDrag,
  onPanelDragStart,
  onPanelDragEnd,
  onCapabilityState,
}: Props) {
  const theme = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [editPanelId, setEditPanelId] = useState<string | null>(null);
  const [dropHighlight, setDropHighlight] = useState(false);
  const gradientActive = useGradientActive();
  const statusPrefs = useStatusLightPrefs();
  const solidContentPanels = useSolidContentPanels();
  const { confirm } = useConfirm();

  const mutedLabel = alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.62 : 0.55);
  const canAcceptDrop =
    editMode &&
    panelDrag &&
    panelDrag.fromSectionId !== sectionId &&
    Boolean(onMovePanel);

  const prevWidthRef = useRef(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0 && w !== prevWidthRef.current) {
        prevWidthRef.current = w;
        setWidth(w);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);


  /** Saved placement (12-wide arrangement, with each panel's size limits). */
  const savedItems = useMemo(
    () =>
      panels
        .filter((p) => typeof p.id === "string" && p.id.trim())
        .map((p) => gridLayoutItemForPanel(p)),
    [panels]
  );
  /** This screen: exactly as arranged when it fits, otherwise flowed in order (flow-layout.ts). */
  const grid = flowGridForWidth(width);
  const cols = grid.cols;
  const rowHeight = Math.max(1, grid.rowHeight);
  const flowed = useMemo(() => flowLayout(savedItems, cols), [savedItems, cols]);

  const [gridLayout, setGridLayout] = useState<Layout[]>(flowed);
  const gridLayoutRef = useRef(gridLayout);

  useLayoutEffect(() => {
    if (gridLayoutsEqual(gridLayoutRef.current, flowed)) return;
    gridLayoutRef.current = flowed;
    setGridLayout(flowed);
  }, [flowed]);

  const commitLayout = useCallback(
    (next: Layout[], resizedId: string | null) => {
      if (!editMode) return;
      if (next.length === 0 && panels.length > 0) return;
      const persisted = clampSectionLayout(panels, flowCommit(savedItems, next, resizedId, cols));
      if (!panelSectionLayoutMatches(panels, persisted)) {
        onLayoutChange(sectionId, persisted);
        return;
      }
      // Nothing to save (e.g. a drop that keeps the order): snap back to the flowed layout.
      gridLayoutRef.current = flowed;
      setGridLayout(flowed);
    },
    [editMode, onLayoutChange, panels, savedItems, cols, flowed, sectionId]
  );

  const editing = editPanelId ? panels.find((p) => p.id === editPanelId) ?? null : null;
  const editorKind = editing ? resolveDashboardEditorKind(editing) : null;
  /** Editors read and write the saved format — exactly what a save would store. */
  const editingSaved = editing ? toRenderPanel(editing) : null;
  const integrationEditWidget =
    editingSaved && editorKind === "integration-panel" ? panelAsGeneralWidget(editingSaved) : null;
  /** What the editing panel shows with no title or icon of its own — shown greyed in its editor. */
  const editingAutomatic: AutomaticTitle | undefined = (() => {
    if (!editing) return undefined;
    const auto = panelHeading({ ...editing, title: undefined }, capabilities, sectionRoomId, cameras);
    return {
      title: auto.title,
      icon: panelTitleIcon(editing.type, runtimeConfigToPanelRecord(editing.config), auto, { ignoreChoice: true }),
    };
  })();

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDropHighlight(false);
    if (!canAcceptDrop) return;
    try {
      const raw = e.dataTransfer.getData(PANEL_DRAG_MIME);
      const parsed = JSON.parse(raw) as { panelId?: string; sectionId?: string };
      if (
        typeof parsed.panelId === "string" &&
        typeof parsed.sectionId === "string" &&
        parsed.sectionId !== sectionId
      ) {
        onMovePanel?.(parsed.sectionId, sectionId, parsed.panelId);
      }
    } catch {
      /* ignore */
    }
    onPanelDragEnd?.();
  }

  return (
    <Box
      ref={hostRef}
      data-nx-section-grid={sectionId}
      onDragOver={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDropHighlight(true);
      }}
      onDragEnter={(e) => {
        if (!canAcceptDrop) return;
        e.preventDefault();
        setDropHighlight(true);
      }}
      onDragLeave={(e) => {
        if (!hostRef.current?.contains(e.relatedTarget as Node)) {
          setDropHighlight(false);
        }
      }}
      onDrop={handleDrop}
      sx={{
        width: "100%",
        minHeight: panels.length ? 160 : 72,
        borderRadius: 2,
        p: editMode ? 1.5 : 0.5,
        bgcolor: (t) =>
          dropHighlight
            ? alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.14 : 0.1)
            : editMode
              ? t.palette.mode === "dark"
                ? "rgba(255,255,255,0.03)"
                : "rgba(0,0,0,0.02)"
              : "transparent",
        outline: editMode || dropHighlight ? "1px dashed" : "none",
        outlineColor: dropHighlight ? "primary.main" : "divider",
        transition: "outline-color 0.15s ease, background-color 0.15s ease",
        /* RGL sets pixel height on .react-grid-item; children must fill it. */
        "& .react-grid-item": {
          overflow: "hidden",
          boxSizing: "border-box",
        },
        "& .react-grid-item > div": {
          width: "100%",
          maxWidth: "100%",
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        },
      }}
    >
      {editMode && panels.length > 0 && (
        <Typography variant="caption" sx={{ display: "block", mb: 1, color: mutedLabel }}>
          Drag the handle to move within this section · use the move icon to drag to another section
        </Typography>
      )}
      {editMode && canAcceptDrop && dropHighlight && (
        <Typography
          variant="caption"
          sx={{ display: "block", mb: 1, color: "primary.main", fontWeight: 600 }}
        >
          Drop here to move into this section
        </Typography>
      )}
      {width > 0 && panels.length > 0 && (
        <GridLayout
          className="layout"
          width={grid.gridWidth}
          layout={gridLayout}
          cols={cols}
          rowHeight={rowHeight}
          margin={[DASHBOARD_GRID_MARGIN_X, DASHBOARD_GRID_MARGIN_Y]}
          containerPadding={[0, 0]}
          isDraggable={editMode}
          isResizable={editMode}
          compactType="vertical"
          preventCollision={false}
          draggableHandle=".widget-drag-handle"
          onResizeStop={(next, _old, item) => commitLayout(next, item.i)}
          onDragStop={(next) => commitLayout(next, null)}
          resizeHandles={["se"]}
        >
          {panels.map((w) => {
            const canEdit = isEditableWidget(w);
            const itemKind = dashboardItemKind(w.type);
            const heading = panelHeading(w, capabilities, sectionRoomId, cameras);
            const tileTitle = heading.title;
            const areaLabel = heading.area;
            const rangeNote =
              normalizePanelKind(w.type) === "panel.charts"
                ? chartRangeLabel(readPanelChartRange(runtimeConfigToPanelRecord(w.config)))
                : null;
            const showTitleTile = Boolean(tileTitle || areaLabel || rangeNote);
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
            const lightAt = (placement: ReturnType<typeof lightPlacement>) =>
              placement && lightCap ? (
                <StatusLight capabilityId={lightCap.id} kind={lightCap.kind} unit={lightCap.unit} look={statusLook} placement={placement} />
              ) : null;
            return (
              <div
                key={w.id}
                data-nx-grid-widget={w.id}
                data-nx-widget-title={tileTitle ?? undefined}
              >
                <Paper
                  elevation={editMode ? 2 : 0}
                  variant={editMode ? "elevation" : "outlined"}
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    boxSizing: "border-box",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    position: "relative",
                    ...contentSurfaceSx(gradientActive, solidContentPanels),
                  }}
                >
                  {titlePlacement === "frame" ? lightAt("frame") : null}
                  {editMode && (
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={0.5}
                      sx={{
                        flexShrink: 0,
                        px: 0.5,
                        py: 0.25,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        bgcolor: (t) =>
                          alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.1 : 0.06),
                      }}
                    >
                      <Tooltip title="Drag to reposition in this section">
                        <IconButton
                          size="small"
                          className="widget-drag-handle"
                          aria-label={`Drag ${itemKind} in section`}
                          sx={{ cursor: "grab", touchAction: "none" }}
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Drag to another section">
                        <IconButton
                          size="small"
                          aria-label={`Move ${itemKind} to another section`}
                          draggable={editMode}
                          sx={{ cursor: "grab", touchAction: "none" }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(
                              PANEL_DRAG_MIME,
                              JSON.stringify({ panelId: w.id, sectionId })
                            );
                            e.dataTransfer.effectAllowed = "move";
                            onPanelDragStart?.(sectionId, w.id);
                          }}
                          onDragEnd={() => onPanelDragEnd?.()}
                        >
                          <DriveFileMoveOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Typography
                        variant="caption"
                        sx={{ flex: 1, color: mutedLabel }}
                        noWrap
                      >
                        {widgetTypeLabel(w.type)}
                      </Typography>
                      {canEdit && (
                        <Tooltip title={`Edit ${itemKind}`}>
                          <IconButton
                            size="small"
                            aria-label={`Edit ${itemKind}`}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={() => setEditPanelId(w.id)}
                          >
                            <TuneIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title={`Remove ${itemKind}`}>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={`Remove ${itemKind}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => {
                            void (async () => {
                              const label = tileTitle || widgetTypeLabel(w.type);
                              const ok = await confirm({
                                title: `Remove ${itemKind}?`,
                                message: `Remove “${label}” from this section? Save the dashboard to keep this change.`,
                                confirmLabel: `Remove ${itemKind}`,
                              });
                              if (ok) onRemovePanel(sectionId, w.id);
                            })();
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )}
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      boxSizing: "border-box",
                      p: "4px",
                      gap: showTitleTile ? "6px" : 0,
                      overflow: "hidden",
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
                        borderRadius: 1.5,
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
                        }}
                      >
                        <WidgetErrorBoundary widgetId={w.id} widgetType={w.type}>
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
              </div>
            );
          })}
        </GridLayout>
      )}
      {panels.length === 0 && (
        <Typography sx={{ p: 2, textAlign: "center", color: mutedLabel }}>
          {editMode
            ? "No panels yet — use Add Panel."
            : "Empty section."}
        </Typography>
      )}

      {editorKind === "scoped-panel" && editing && editingSaved && (
        <PanelWidgetEditor
          open
          widget={editingSaved}
          sectionRoomId={sectionRoomId}
          sectionTitle={sectionTitle}
          automatic={editingAutomatic}
          onClose={() => setEditPanelId(null)}
          onSave={(patch) => {
            onUpdatePanel(sectionId, editing.id, patch);
          }}
        />
      )}

      {editorKind === "integration-panel" && integrationEditWidget && editing && (
        <GeneralWidgetEditor
          open
          widget={integrationEditWidget}
          automatic={editingAutomatic}
          onClose={() => setEditPanelId(null)}
          onSave={(patch) => {
            onUpdatePanel(sectionId, editing.id, {
              ...patch,
              type: editing.type,
            });
          }}
        />
      )}

      {editorKind === "gauge" && editing && editingSaved && (
        <EChartsWidgetEditor
          open
          widget={editingSaved}
          capabilities={capabilities}
          onClose={() => setEditPanelId(null)}
          onSave={(patch) => {
            onUpdatePanel(sectionId, editing.id, patch);
          }}
        />
      )}
    </Box>
  );
}
