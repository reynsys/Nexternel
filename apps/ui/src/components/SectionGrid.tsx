import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import {
  Box,
  Button,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/Add";
import type { CameraRecord, Capability, PanelInstance } from "../api";
import type { RuntimePanelInstance } from "../lib/panel-compatibility/types";
import { runtimeConfigToPanelRecord } from "../lib/panel-compatibility/panel-config";
import { toRenderPanel } from "../lib/panel-compatibility/render-adapter";
import { PANEL_DRAG_HANDLE, PANEL_NO_DRAG, PanelCard } from "./PanelCard";
import { PanelPlaceActions, PanelPlaceContext, type PanelPlace } from "./panel-editor/PanelPlaceActions";
import { SidePanel } from "./side-panel/SidePanel";
import { PanelPreview } from "./panel-editor/PanelEditorShell";
import { PluginPanelEditor } from "./panel-editor/PluginPanelEditor";
import { mergeRuntimePanelPatch } from "../lib/panel-compatibility/normalize-panel";
import { flowCommit, flowGridForWidth, flowLayout } from "../panels/flow-layout";
import { PanelWidgetEditor, isPanelWidgetType, panelLabel } from "../widgets/panel";
import { GAUGE_WIDGET_TYPE } from "../widgets/gauge";
import { EChartsWidgetEditor } from "../widgets/echarts/EChartsWidgetEditor";
import { isEchartsWidgetType } from "../widgets/echarts/config";
import { getPanelContribution } from "../plugins/registry";
import { panelTitleIcon } from "../lib/panel-title-icon";
import type { AutomaticTitle } from "./PanelTitleFields";
import { minPanelRowPx, panelHeading } from "../lib/panel-heading";
import {
  panelAsGeneralWidget,
  resolveDashboardEditorKind,
} from "../lib/panel-editor-route";
import { GeneralWidgetEditor } from "../widgets/GeneralWidgetEditor";
import { migrateContributionPanelType, isPluginPanelType } from "@nexternel/domain";
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
import type { PanelActivity } from "../lib/dashboard-data-runtime";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { createEdgeScroller } from "../lib/edge-scroll";

/** Diagonal two-way arrow (Material "open in full"), drawn in the handle with a mask. */
const RESIZE_ARROW = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z"/></svg>')}")`;

type Props = {
  /** Columns the dashboard's panels are arranged on (12, 10 or 8). */
  gridCols?: number;
  sectionId: string;
  sectionRoomId?: string | null;
  sectionTitle?: string;
  panels: RuntimePanelInstance[];
  capabilities: Capability[];
  /** Every camera, so camera panels can name their title strip like other panels. */
  cameras?: CameraRecord[];
  editMode: boolean;
  /** Add a panel to this section (while editing). */
  onAddPanel?: () => void;
  /** Start editing with a panel being added here (people who may edit, outside editing). */
  onStartAdding?: () => void;
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
  /** The dashboard's other sections, for "Move to section". */
  moveTargets?: { id: string; title: string }[];
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


/** A panel's button while arranging, in its title: Edit (move and remove are in its Edit menu too). */
function PanelEditButton({ name, kind, onEdit }: { name: string; kind: "panel" | "plugin"; onEdit: () => void }) {
  return (
    <Tooltip title={`Edit this ${kind}`}>
      <Button variant="outlined" size="small" aria-label={`Edit ${name}`} onClick={onEdit} sx={{ minWidth: 32, width: 32, height: 32, p: 0 }}>
        <EditOutlinedIcon fontSize="small" />
      </Button>
    </Tooltip>
  );
}

/**
 * RGL inside accordion/collapse needs measured width — WidthProvider often stays at 0.
 */
export function SectionGrid({
  gridCols = 12,
  sectionId,
  sectionRoomId,
  sectionTitle,
  panels,
  capabilities,
  cameras = [],
  editMode,
  onAddPanel,
  onStartAdding,
  activity = "visible",
  onLayoutChange,
  onRemovePanel,
  onUpdatePanel,
  onMovePanel,
  moveTargets = [],
  onCapabilityState,
}: Props) {
  const theme = useTheme();
  const edgeScroller = useMemo(() => createEdgeScroller(), []);
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [editPanelId, setEditPanelId] = useState<string | null>(null);
  // Leaving edit mode (Save or Cancel) closes a panel's Edit menu.
  useEffect(() => {
    if (!editMode) setEditPanelId(null);
  }, [editMode]);

  const mutedLabel = alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.62 : 0.55);

  const prevWidthRef = useRef(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      // The grid sits inside the box's padding, so it gets the content width.
      const cs = getComputedStyle(el);
      const w = Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
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
  // Rows are never shorter than the Look's panel frame and title need (thick frames, e.g. HUD, on phones).
  const grid = flowGridForWidth(width, gridCols, minPanelRowPx(theme.nx?.panelInset));
  const cols = grid.cols;
  const rowHeight = Math.max(1, grid.rowHeight);
  const flowed = useMemo(() => flowLayout(savedItems, cols, gridCols), [savedItems, cols, gridCols]);

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
      const persisted = clampSectionLayout(panels, flowCommit(savedItems, next, resizedId, cols, gridCols));
      if (!panelSectionLayoutMatches(panels, persisted)) {
        onLayoutChange(sectionId, persisted);
        return;
      }
      // Nothing to save (e.g. a drop that keeps the order): snap back to the flowed layout.
      gridLayoutRef.current = flowed;
      setGridLayout(flowed);
    },
    [editMode, onLayoutChange, panels, savedItems, cols, flowed, sectionId, gridCols]
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

  /** The editing panel's size on this dashboard, so the Edit menu's preview matches it. */
  const editingSize = (() => {
    const item = editing ? gridLayout.find((l) => l.i === editing.id) : undefined;
    if (!item || grid.gridWidth <= 0) return { width: 440, height: 220 };
    const colW = (grid.gridWidth - DASHBOARD_GRID_MARGIN_X * (cols - 1)) / cols;
    return {
      width: item.w * colW + (item.w - 1) * DASHBOARD_GRID_MARGIN_X,
      height: item.h * rowHeight + (item.h - 1) * DASHBOARD_GRID_MARGIN_Y,
    };
  })();
  /** Where the panel being edited sits: its Edit menu can move it to another section or remove it. */
  const editingPlace: PanelPlace | null = editing
    ? {
        name: panelHeading(editing, capabilities, sectionRoomId, cameras).title || widgetTypeLabel(editing.type),
        kind: dashboardItemKind(editing.type),
        section: { id: sectionId, title: sectionTitle ?? "" },
        moveTargets: onMovePanel ? moveTargets : [],
        onMove: (to) => {
          setEditPanelId(null);
          onMovePanel?.(sectionId, to, editing.id);
        },
        onRemove: () => {
          setEditPanelId(null);
          onRemovePanel(sectionId, editing.id);
        },
      }
    : null;
  const renderPreview = (patch: Partial<PanelInstance>) =>
    editing ? (
      <PanelPreview
        panel={mergeRuntimePanelPatch(editing, patch)}
        size={editingSize}
        capabilities={capabilities}
        cameras={cameras}
        sectionRoomId={sectionRoomId}
      />
    ) : null;

  return (
    <Box
      ref={hostRef}
      data-nx-section-grid={sectionId}
      // Pressing the resize corner must not start the browser's own selection scrolling (it races
      // ahead of the grid); the calm edge scrolling in lib/edge-scroll.ts takes care of it.
      onMouseDownCapture={(e) => {
        if ((e.target as Element).closest?.(".react-resizable-handle")) e.preventDefault();
      }}
      sx={{
        width: "100%",
        minHeight: panels.length ? 160 : 72,
        // Resize corner: a clear round handle with a diagonal arrow, above everything in the panel
        // (its content layer is raised above the Look's panel frame), so it is easy to find and grab.
        "& .react-grid-item > .react-resizable-handle.react-resizable-handle-se": (t) => ({
          zIndex: 20,
          width: 30,
          height: 30,
          right: 4,
          bottom: 4,
          padding: 0,
          backgroundImage: "none",
          borderRadius: "50%",
          backgroundColor: t.palette.primary.main,
          boxShadow: `0 0 0 2px ${t.palette.background.paper}, 0 2px 8px rgba(0,0,0,.45)`,
          transition: "transform .15s ease",
          "&:hover": { transform: "scale(1.15)" },
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 6,
            width: "auto",
            height: "auto",
            border: 0,
            backgroundColor: t.palette.primary.contrastText,
            WebkitMaskImage: RESIZE_ARROW,
            maskImage: RESIZE_ARROW,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            transform: "rotate(90deg)",
          },
        }),
        // The size preview while resizing or moving: accent stripes and a dashed outline, visible on any background.
        "& .react-grid-item.react-grid-placeholder": (t) => ({
          opacity: 1,
          borderRadius: 1,
          background: `repeating-linear-gradient(45deg, ${alpha(t.palette.primary.main, 0.38)} 0 10px, ${alpha(t.palette.primary.main, 0.14)} 10px 20px)`,
          outline: `2px dashed ${t.palette.primary.main}`,
          outlineOffset: "-2px",
        }),
        // The same in both modes: arranging the dashboard does not move or resize anything.
        p: 0.5,
        /* RGL sets pixel height on .react-grid-item; children must fill it. */
        // Each panel keeps its own content inside (PanelCard clips); the grid cell does not, so a
        // Look's panel shadows and frames are never cut off.
        "& .react-grid-item": {
          overflow: "visible",
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
          draggableHandle={`.${PANEL_DRAG_HANDLE}`}
          draggableCancel={`.${PANEL_NO_DRAG}`}
          onResizeStart={(_l, _o, _n, _p, e) => edgeScroller.start(e)}
          onResize={(_l, _o, _n, _p, e) => edgeScroller.move(e)}
          onResizeStop={(next, _old, item) => {
            edgeScroller.stop();
            commitLayout(next, item.i);
          }}
          onDragStop={(next) => commitLayout(next, null)}
          resizeHandles={["se"]}
        >
          {panels.map((w) => {
            const itemKind = dashboardItemKind(w.type);
            const tileTitle = panelHeading(w, capabilities, sectionRoomId, cameras).title;
            return (
              <div
                key={w.id}
                data-nx-grid-widget={w.id}
                data-nx-widget-title={tileTitle ?? undefined}
              >
                <PanelCard
                  panel={w}
                  capabilities={capabilities}
                  cameras={cameras}
                  sectionRoomId={sectionRoomId}
                  editMode={editMode}
                  activity={activity}
                  onCapabilityState={onCapabilityState}
                  editFallbackTitle={widgetTypeLabel(w.type)}
                  editActions={
                    editMode ? <PanelEditButton name={tileTitle || widgetTypeLabel(w.type)} kind={itemKind} onEdit={() => setEditPanelId(w.id)} /> : undefined
                  }
                />
              </div>
            );
          })}
        </GridLayout>
      )}
      {panels.length === 0 && (
        <Stack alignItems="center" spacing={1.5} sx={{ p: 2 }}>
          <Typography sx={{ textAlign: "center", color: mutedLabel }}>
            {editMode || onStartAdding ? "No panels here yet." : "Empty section."}
          </Typography>
          {/* While editing: add a panel here. Otherwise (for people who may edit): start editing with it. */}
          {(editMode ? onAddPanel : onStartAdding) ? (
            <Button variant={editMode ? "contained" : "outlined"} startIcon={<AddIcon />} onClick={editMode ? onAddPanel : onStartAdding}>
              {editMode ? "Add panel" : "Add panels"}
            </Button>
          ) : null}
        </Stack>
      )}

      <PanelPlaceContext.Provider value={editingPlace}>
      {editorKind === "scoped-panel" && editing && editingSaved && (
        <PanelWidgetEditor
          open
          widget={editingSaved}
          sectionRoomId={sectionRoomId}
          sectionTitle={sectionTitle}
          automatic={editingAutomatic}
          renderPreview={renderPreview}
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
          renderPreview={(patch) => renderPreview({ ...patch, type: editing.type })}
          onClose={() => setEditPanelId(null)}
          onSave={(patch) => {
            onUpdatePanel(sectionId, editing.id, {
              ...patch,
              type: editing.type,
            });
          }}
        />
      )}

      {editorKind === "plugin-panel" && editing && editingSaved && (
        <PluginPanelEditor
          open
          widget={editingSaved}
          kindLabel={getPanelContribution(editing.type)?.label ?? "Plugin panel"}
          automatic={editingAutomatic}
          renderPreview={renderPreview}
          onClose={() => setEditPanelId(null)}
          onSave={(patch) => {
            onUpdatePanel(sectionId, editing.id, patch);
          }}
        />
      )}

      {editorKind === "gauge" && editing && editingSaved && (
        <EChartsWidgetEditor
          open
          widget={editingSaved}
          capabilities={capabilities}
          renderPreview={renderPreview}
          onClose={() => setEditPanelId(null)}
          onSave={(patch) => {
            onUpdatePanel(sectionId, editing.id, patch);
          }}
        />
      )}
      {editing && editorKind === null && (
        // A panel type without settings of its own: its Edit menu has only where it sits.
        <SidePanel open onClose={() => setEditPanelId(null)} title={`Edit ${editingPlace?.name ?? "panel"}`}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              This panel has no settings of its own.
            </Typography>
            <PanelPlaceActions />
          </Stack>
        </SidePanel>
      )}
      </PanelPlaceContext.Provider>
    </Box>
  );
}
