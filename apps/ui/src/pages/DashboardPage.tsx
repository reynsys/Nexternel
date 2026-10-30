import { useEffect, useMemo, useRef, useState } from "react";
import { setLeaveGuard } from "../lib/leave-guard";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { type Layout } from "react-grid-layout";
import {
  Accordion,
  AccordionDetails,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AddIcon from "@mui/icons-material/Add";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  api,
  type CameraRecord,
  type Capability,
  type DashboardDocument,
  type ResolvedPanelCapability,
  type PanelInstance,
} from "../api";
import { getPanelContribution } from "../plugins/registry";
import {
  loadAddPanelDiscoveryCatalog,
  type AddPanelDiscoveryItem,
} from "../lib/add-panel-discovery";
import { AddPanelTypePicker } from "../components/AddPanelTypePicker";
import {
  isCorePanelCatalogType,
  panelUsesAreaScope,
  panelUsesCapabilityScope,
  readPanelStatusLight,
  type PanelContentMode,
  type PanelStatusLight,
} from "@nexternel/domain";
import {
  DEFAULT_SECTION_ICON,
  emptyDocument,
  newId,
  nextWidgetPlacement,
  normalizeSectionColSpan,
  sortSections,
} from "../lib/dashboard-document";
import { SlotBindingFields } from "../components/SlotBindingFields";
import { PanelCameraContentFields } from "../components/PanelCameraContentFields";
import { PanelContentFields } from "../components/PanelContentFields";
import { StatusLightEditorSection, statusLightConfig } from "../components/status-light/StatusLightFields";
import { validateAddPanelReady } from "../lib/add-panel-validation";
import { bindingsFromSlots } from "../lib/widget-bindings";
import { suggestSlotBindings } from "../lib/slot-bindings";
import { SectionGrid } from "../components/SectionGrid";
import { AREA } from "../lib/area-labels";
import { fetchSelectablePanelOptions } from "../widgets/panel";
import {
  buildPanelScopeConfig,
  previewPanelScopeForItemOptions,
} from "../lib/panel-scope";
import { PLUGIN_ITEM_PICKER_HEADING } from "../lib/panel-content-copy";
import {
  decodePanelInstance,
  mergeRuntimePanelPatch,
  normalizeDashboardDocument,
  sectionPanels,
  sectionPanelCount,
  sectionWithPanels,
  serializeDashboardDocumentV3,
  type RuntimeDashboardSection,
  type RuntimePanelInstance,
} from "../lib/panel-compatibility";
import { DashboardTabBar } from "../components/DashboardTabBar";
import { PageBar } from "../components/PageBar";
import { DashboardSettingsPanel, type DashboardSettingsPage } from "../components/dashboard-editor/DashboardSettingsPanel";
import { SectionSettingsPanel } from "../components/dashboard-editor/SectionSettingsPanel";
import { SidePanel, SidePanelProvider } from "../components/side-panel/SidePanel";
import { DashboardErrorBoundary } from "../components/DashboardErrorBoundary";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { useShellAuth } from "../skins/useShellAuth";
import { hasPermission } from "../lib/permissions";
import { sectionSx } from "../skins/surfaceStyles";
import { LookDecor } from "../skins/looks/LookDecor";
import { useGradientActive } from "../skins/useSurfaceStyles";
import { resolveHomeDashboardId } from "../lib/home-dashboard";
import { dashboardIdForSlug, dashboardPaths } from "../lib/dashboard-path";
import { GAUGE_WIDGET_TYPE } from "../widgets/gauge";
import { defaultPresetForKind } from "../widgets/echarts/config";
import {
  clampSectionLayout,
  enforcePanelPlacement,
  panelPlacementLimits,
  panelSectionLayoutMatches,
} from "../panels/placement";
import {
  DashboardDataRuntimeProvider,
  useDashboardDataRuntime,
} from "../lib/dashboard-data-runtime";
import { ButtonRow } from "../components/ButtonRow";
import { useLiveChanges } from "../lib/live-changes";
import { displayPath, useDisplayMode } from "../lib/display-mode";
import { useSkin } from "../skins/SkinProvider";
import { normalizeRoomNav, shownRoomNav } from "../lib/room-nav";
import { rearrangeForColumns } from "../panels/flow-layout";

function sectionContentSummary(panels: RuntimePanelInstance[]): string {
  const count = panels.length;
  if (!count) return "";
  return `${count} panel${count === 1 ? "" : "s"}`;
}

function DashboardPageContent() {
  /** `/dashboards/<id>` (old links) or `/d/<slug>` (readable); neither means the default. */
  const { id: routeIdParam, slug: routeSlug } = useParams<{ id?: string; slug?: string }>();
  const dataRuntime = useDashboardDataRuntime();
  const [dashboardId, setDashboardId] = useState<string | null>(routeIdParam ?? null);
  const [pageLoading, setPageLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const { permissions, isAdmin } = useShellAuth();
  const display = useDisplayMode();
  const { themePrefs: navPrefs } = useSkin();
  const roomNav = shownRoomNav(normalizeRoomNav(navPrefs.roomNav), useMediaQuery(useTheme().breakpoints.down("md")));
  // Display mode only shows: no editing there.
  const canEditDashboards = !display.active && hasPermission(
    permissions,
    "editDashboards",
    isAdmin
  );
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const gradientActive = useGradientActive();
  const [name, setName] = useState("Dashboard");
  const [tabIcon, setTabIcon] = useState("dashboard");
  const [showTabLabel, setShowTabLabel] = useState(true);
  const [showSectionNav, setShowSectionNav] = useState(false);
  /** Columns panels are arranged on (12 = 6 across, 10 = 5 across, 8 = 4 across). */
  const [gridCols, setGridCols] = useState<12 | 10 | 8>(10);
  const [sections, setSections] = useState<RuntimeDashboardSection[]>(
    () => emptyDocument().sections as RuntimeDashboardSection[]
  );
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  /** Camera list for camera panel titles; a failed load only means generic titles. */
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addPanelSectionId, setAddPanelSectionId] = useState("");
  const [addPanelType, setAddPanelType] = useState("panel.controls");
  const [addPanelInheritSection, setAddPanelInheritSection] = useState(true);
  const [addPanelAreaId, setAddPanelAreaId] = useState("");
  const [addPanelAreas, setAddPanelAreas] = useState<{ id: string; name: string }[]>([]);
  const [addPanelSystemIds, setAddPanelSystemIds] = useState<string[]>([]);
  const [addPanelCapabilityIds, setAddPanelCapabilityIds] = useState<string[]>([]);
  const [addPanelCameraIds, setAddPanelCameraIds] = useState<string[]>([]);
  const [addPanelCameras, setAddPanelCameras] = useState<CameraRecord[]>([]);
  const [addPanelContentMode, setAddPanelContentMode] = useState<PanelContentMode>("manual");
  const [addPanelScopeCapabilities, setAddPanelScopeCapabilities] = useState<
    ResolvedPanelCapability[]
  >([]);
  const [addPanelCatalog, setAddPanelCatalog] = useState<AddPanelDiscoveryItem[]>([]);
  const [addPanelSlotValues, setAddPanelSlotValues] = useState<Record<string, string>>({});
  const [addPanelTitle, setAddPanelTitle] = useState("");
  const [addPanelStatusLight, setAddPanelStatusLight] = useState<PanelStatusLight>(() => readPanelStatusLight(null));
  const [addSectionId, setAddSectionId] = useState<string>("");
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  /** The side panel with the dashboard's or one section's settings (one at a time). */
  const [settingsPanel, setSettingsPanel] = useState<
    { type: "dashboard"; page: DashboardSettingsPage } | { type: "section"; id: string } | null
  >(null);
  const [editBaseline, setEditBaseline] = useState<{
    name: string;
    tabIcon: string;
    showTabLabel: boolean;
    showSectionNav: boolean;
    gridCols: 12 | 10 | 8;
    sections: RuntimeDashboardSection[];
  } | null>(null);

  /** Changes made since editing started (compared with the copy taken then). */
  const unsaved = useMemo(
    () =>
      editMode &&
      editBaseline !== null &&
      JSON.stringify({ name, tabIcon, showTabLabel, showSectionNav, gridCols, sections }) !== JSON.stringify(editBaseline),
    [editMode, editBaseline, name, tabIcon, showTabLabel, showSectionNav, gridCols, sections]
  );
  /** Leaving with unsaved changes: where the person wanted to go, while they choose. */
  const [leaveAsk, setLeaveAsk] = useState<{ go: () => void } | null>(null);
  const leaveRef = useRef<(go: () => void) => void>(() => undefined);
  leaveRef.current = (go) => {
    if (!unsaved) {
      cancelEdit();
      go();
    } else setLeaveAsk({ go });
  };
  // Closing the browser tab or typing another address: the browser's own "Leave site?" question.
  useEffect(() => {
    if (!unsaved) return undefined;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  // While editing, every way out of this dashboard (rooms, side menu, All dashboards) asks first.
  useEffect(() => {
    if (!editMode) return undefined;
    setLeaveGuard((go) => leaveRef.current(go));
    return () => setLeaveGuard(null);
  }, [editMode]);

  const addPanelIsCore = isCorePanelCatalogType(addPanelType);
  // The readings the new panel will show: picked ones (or all in scope when automatic), or a plugin/gauge's chosen readings.
  const addPanelReadings = useMemo(() => {
    const picked = addPanelIsCore
      ? addPanelType === "panel.camera"
        ? []
        : addPanelContentMode === "manual"
          ? addPanelScopeCapabilities.filter((c) => addPanelCapabilityIds.includes(c.id))
          : addPanelScopeCapabilities
      : Object.values(addPanelSlotValues)
          .map((id) => capabilities.find((c) => c.id === id))
          .filter((c): c is Capability => Boolean(c));
    return picked.map((c) => ({ id: c.id, name: c.name, unit: c.unit, kind: c.kind }));
  }, [addPanelIsCore, addPanelType, addPanelContentMode, addPanelScopeCapabilities, addPanelCapabilityIds, addPanelSlotValues, capabilities]);
  const addPanelShowsAreaScope = addPanelIsCore && panelUsesAreaScope(addPanelType);
  const addPanelShowsSystemFilter = addPanelIsCore && panelUsesCapabilityScope(addPanelType);
  const addPanelShowsCameraContent = addPanelIsCore && addPanelType === "panel.camera";
  const addPanelValidation = useMemo(
    () =>
      validateAddPanelReady({
        panelType: addPanelType,
        contentMode: addPanelContentMode,
        capabilityIds: addPanelCapabilityIds,
        cameraIds: addPanelCameraIds,
        scopeCapabilities: addPanelScopeCapabilities,
        cameras: addPanelCameras,
        slotValues: addPanelSlotValues,
      }),
    [
      addPanelType,
      addPanelContentMode,
      addPanelCapabilityIds,
      addPanelCameraIds,
      addPanelScopeCapabilities,
      addPanelCameras,
      addPanelSlotValues,
    ]
  );
  const selectedContribution = addPanelIsCore ? undefined : getPanelContribution(addPanelType);
  const bindingSlots = selectedContribution?.bindingSlots ?? [];
  const hasBindingSlots = bindingSlots.length > 0;



  const ordered = useMemo(() => sortSections(sections), [sections]);
  const DashIcon = getDashboardIcon(tabIcon);
  // The section whose settings open comes into view, so its changes can be seen.
  const settingsSectionId = settingsPanel?.type === "section" ? settingsPanel.id : null;
  useEffect(() => {
    if (!settingsSectionId) return;
    requestAnimationFrame(() =>
      document.getElementById(`dash-section-${settingsSectionId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  }, [settingsSectionId]);

  function applyLive(
    capabilityId: string,
    value: unknown,
    quality = "good",
    updatedAt = new Date().toISOString()
  ) {
    dataRuntime.applyCapabilityState({
      capabilityId,
      value,
      quality,
      updatedAt,
    });
  }

  function loadDocument(doc: unknown, dashName: string) {
    const normalized = normalizeDashboardDocument(doc, dashName);
    setName(normalized.name);
    setTabIcon(normalized.tabIcon ?? "dashboard");
    setShowTabLabel(normalized.showTabLabel !== false);
    setShowSectionNav(normalized.showSectionNav === true);
    setGridCols((normalized as { gridCols?: 12 | 10 | 8 }).gridCols ?? 10);
    setSections(normalized.sections);
    if (normalized.sections[0]) setAddSectionId(normalized.sections[0].id);
  }

  useEffect(() => {
    if (!addPanelOpen || addPanelIsCore) return;
    const slots = getPanelContribution(addPanelType)?.bindingSlots;
    if (!slots?.length) {
      setAddPanelSlotValues({});
      return;
    }
    setAddPanelSlotValues(
      suggestSlotBindings(slots, capabilities, {
        deviceName: undefined,
      })
    );
  }, [addPanelOpen, addPanelType, addPanelIsCore]);

  /** Fill empty binding slots when capabilities load — never overwrite a user pick. */
  useEffect(() => {
    if (!addPanelOpen || addPanelIsCore) return;
    const slots = getPanelContribution(addPanelType)?.bindingSlots;
    if (!slots?.length) return;
    setAddPanelSlotValues((prev) => {
      const suggested = suggestSlotBindings(slots, capabilities, {
        deviceName: undefined,
      });
      let changed = false;
      const next = { ...prev };
      for (const slot of slots) {
        if (!prev[slot.key]?.trim() && suggested[slot.key]) {
          next[slot.key] = suggested[slot.key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [capabilities, addPanelOpen, addPanelType, addPanelIsCore]);

  /** Reload capabilities when opening Add Panel (picks up devices added after page load). */
  useEffect(() => {
    if (!addPanelOpen) return;
    void (async () => {
      try {
        const caps = await api.capabilities();
        setCapabilities(caps.capabilities);
      } catch {
        /* keep existing list */
      }
    })();
  }, [addPanelOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPageLoading(true);
      setBootError(null);
      try {
        let targetId = routeIdParam?.trim() || null;
        if (!targetId && routeSlug) {
          const list = await api.dashboards();
          targetId = dashboardIdForSlug(list.dashboards, routeSlug);
          if (!targetId) {
            if (!cancelled) {
              setDashboardId(null);
              setBootError(`No dashboard is called “${routeSlug}”. Pick one from the tabs above.`);
            }
            return;
          }
        }
        if (!targetId) {
          targetId = await resolveHomeDashboardId();
        }
        if (!targetId) {
          if (!cancelled) {
            setDashboardId(null);
            setBootError("No dashboards yet. Use + Add dashboard in the Dashboard Menu to create one.");
          }
          return;
        }
        const [dash, caps, cams] = await Promise.all([
          api.getDashboard(targetId),
          api.capabilities(),
          api.cameras().catch(() => ({ cameras: [] as CameraRecord[] })),
        ]);
        if (cancelled) return;
        setDashboardId(targetId);
        loadDocument(dash.dashboard.document, dash.dashboard.name);
        setCapabilities(caps.capabilities);
        setCameras(cams.cameras);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeIdParam, routeSlug]);

  // A dashboard just created opens ready to edit (Add panel at hand), not as an empty page.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (pageLoading || !dashboardId || editMode) return;
    if ((location.state as { startEditing?: boolean } | null)?.startEditing) {
      if (canEditDashboards) enterEditMode();
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageLoading, dashboardId, location.state]);

  // A dashboard, device, camera or area changed on another screen: show it here (not while editing).
  useLiveChanges(
    ["dashboards", "capabilities", "devices", "cameras", "rooms"],
    (topic) => {
      if (!dashboardId) return;
      void Promise.all([
        api.getDashboard(dashboardId),
        api.capabilities(),
        api.cameras().catch(() => ({ cameras: [] as CameraRecord[] })),
      ])
        .then(([dash, caps, cams]) => {
          if (topic !== "dashboards") dataRuntime.resolvers.clear();
          loadDocument(dash.dashboard.document, dash.dashboard.name);
          setCapabilities(caps.capabilities);
          setCameras(cams.cameras);
        })
        .catch(() => {
          /* e.g. this dashboard was deleted: keep what is shown */
        });
    },
    !editMode && !pageLoading && Boolean(dashboardId)
  );

  /** Show the readable address (`/` or `/d/<name>`), also for old `/dashboards/<id>` links. */
  useEffect(() => {
    if (pageLoading || !dashboardId) return;
    let cancelled = false;
    void api.dashboards().then((res) => {
      if (cancelled) return;
      const plain = dashboardPaths(res.dashboards).get(dashboardId);
      const path = plain && display.active ? displayPath(plain) : plain;
      if (path && path !== window.location.pathname) {
        window.history.replaceState(null, "", path + (display.active ? window.location.search : ""));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pageLoading, dashboardId, display.active]);


  useEffect(() => {
    dataRuntime.capabilities.seed(capabilities);
  }, [capabilities, dataRuntime]);

  function updateSection(
    sectionId: string,
    patch:
      | Partial<RuntimeDashboardSection>
      | ((s: RuntimeDashboardSection) => RuntimeDashboardSection)
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        return typeof patch === "function" ? patch(s) : { ...s, ...patch };
      })
    );
  }

  /** Rearrange every section for a new number of columns (same order and shapes). */
  function changePanelsAcross(cols: 12 | 10 | 8) {
    if (cols === gridCols) return;
    setGridCols(cols);
    setSections((prev) =>
      prev.map((s) => {
        const list = sectionPanels(s);
        if (!list.length) return s;
        const placed = rearrangeForColumns(
          list.map((w) => ({ i: w.id, x: w.layout.x, y: w.layout.y, w: w.layout.w, h: w.layout.h })),
          cols
        );
        return sectionWithPanels(
          s,
          list.map((w) => {
            const l = placed.find((x) => x.i === w.id);
            return l ? enforcePanelPlacement({ ...w, layout: { i: w.id, x: l.x, y: l.y, w: l.w, h: l.h } }) : w;
          })
        );
      })
    );
  }

  function onLayoutChange(sectionId: string, next: Layout[]) {
    if (!editMode) return;
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        if (next.length === 0 && sectionPanels(s).length > 0) return s;
        const clamped = clampSectionLayout(sectionPanels(s), next);
        if (panelSectionLayoutMatches(sectionPanels(s), clamped)) return s;
        return sectionWithPanels(
          s,
          sectionPanels(s).map((w) => {
            const l = clamped.find((x) => x.i === w.id);
            if (!l) return enforcePanelPlacement(w);
            return enforcePanelPlacement({
              ...w,
              layout: {
                i: w.id,
                x: l.x,
                y: Number.isFinite(l.y) ? l.y : w.layout.y,
                w: l.w,
                h: l.h,
              },
            });
          })
        );
      })
    );
  }

  function addSection() {
    const order = sections.length === 0 ? 0 : Math.max(...sections.map((s) => s.order)) + 1;
    const section: RuntimeDashboardSection = {
      id: newId("section"),
      title: `Section ${order + 1}`,
      order,
      collapsed: false,
      icon: DEFAULT_SECTION_ICON,
      colSpan: 12,
      panels: [],
    };
    setSections((prev) => [...prev, section]);
    setAddSectionId(section.id);
    // Straight to its settings, to name it.
    setSettingsPanel({ type: "section", id: section.id });
  }

  function removeSection(sectionId: string) {
    // A dashboard keeps at least one section (Section settings does not offer it then).
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setSettingsPanel(null);
  }

  function moveSection(sectionId: string, dir: -1 | 1) {
    const sorted = sortSections(sections);
    const idx = sorted.findIndex((s) => s.id === sectionId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= sorted.length) return;
    const a = sorted[idx]!;
    const b = sorted[swap]!;
    const next = sorted.map((s) => {
      if (s.id === a.id) return { ...s, order: b.order };
      if (s.id === b.id) return { ...s, order: a.order };
      return s;
    });
    // reassign contiguous orders
    const reordered = sortSections(next).map((s, i) => ({ ...s, order: i }));
    setSections(reordered);
  }

  function openAddPanel(sectionId?: string) {
    const sid = sectionId || addSectionId || sections[0]?.id || "";
    if (sectionId) setAddSectionId(sectionId);
    const section = sections.find((s) => s.id === sid);
    setAddPanelSectionId(sid);
    setAddPanelType("panel.controls");
    setAddPanelInheritSection(Boolean(section?.roomId));
    setAddPanelAreaId("");
    setAddPanelSystemIds([]);
    setAddPanelCapabilityIds([]);
    setAddPanelCameraIds([]);
    setAddPanelCameras([]);
    setAddPanelScopeCapabilities([]);
    setAddPanelSlotValues({});
    setAddPanelTitle("");
    setAddPanelStatusLight(readPanelStatusLight(null));
    setAddPanelOpen(true);
    void api.rooms().then((r) => {
      setAddPanelAreas(r.rooms.map((room) => ({ id: room.id, name: room.name })));
    });
    void fetchSelectablePanelOptions().then(() => {
      const catalog = loadAddPanelDiscoveryCatalog();
      setAddPanelCatalog(catalog);
      const controls = catalog.find((item) => item.id === "panel.controls");
      setAddPanelType(controls?.id ?? catalog[0]?.id ?? "panel.controls");
    });
  }

  function addPanel() {
    const sectionId = addPanelSectionId || sections[0]?.id;
    if (!sectionId) {
      setError("Add a section first");
      return;
    }

    const validation = validateAddPanelReady({
      panelType: addPanelType,
      contentMode: addPanelContentMode,
      capabilityIds: addPanelCapabilityIds,
      cameraIds: addPanelCameraIds,
      scopeCapabilities: addPanelScopeCapabilities,
      cameras: addPanelCameras,
      slotValues: addPanelSlotValues,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    if (!isCorePanelCatalogType(addPanelType)) {
      const contribution = getPanelContribution(addPanelType);
      if (!contribution) {
        setError("Unknown panel type");
        return;
      }
      const slotDefs = contribution.bindingSlots ?? [];
      const hasSlots = slotDefs.length > 0;

      if (hasSlots) {
        const missing = slotDefs.filter(
          (s) => s.required && !addPanelSlotValues[s.key]?.trim()
        );
        if (missing.length > 0) {
          setError(`Choose: ${missing.map((s) => s.label).join(", ")}`);
          return;
        }
      }

      const widgetId = newId("w");
      const placement = panelPlacementLimits(addPanelType);

      const config: Record<string, unknown> = {};
      const boundCapId =
        addPanelSlotValues.primary ??
        Object.values(addPanelSlotValues).find((id) => id?.trim()) ??
        "";
      const boundCap = capabilities.find((c) => c.id === boundCapId);
      const customTitle = addPanelTitle.trim();
      if (addPanelType === GAUGE_WIDGET_TYPE) {
        config.presetId = defaultPresetForKind(boundCap?.kind);
      }
      Object.assign(config, statusLightConfig(addPanelStatusLight));

      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sectionId) return s;
          const pos = nextWidgetPlacement(sectionPanels(s), placement.preferredW);
          const panel = decodePanelInstance(
            enforcePanelPlacement({
              id: widgetId,
              type: addPanelType,
              title:
                customTitle ||
                (addPanelType === GAUGE_WIDGET_TYPE ? boundCap?.name : undefined) ||
                undefined,
              layout: {
                i: widgetId,
                x: pos.x,
                y: pos.y,
                w: placement.preferredW,
                h: placement.preferredH,
              },
              bindings: hasSlots ? bindingsFromSlots(addPanelSlotValues) : {},
              config,
            })
          );
          return sectionWithPanels(s, [...sectionPanels(s), panel]);
        })
      );
      setError(null);
      setAddPanelOpen(false);
      return;
    }

    const section = sections.find((s) => s.id === sectionId);
    const placement = panelPlacementLimits(addPanelType);
    const widgetId = newId("w");
    const customTitle = addPanelTitle.trim();

    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const pos = nextWidgetPlacement(sectionPanels(s), placement.preferredW);
        const panel = decodePanelInstance(
          enforcePanelPlacement({
            id: widgetId,
            type: addPanelType,
            title: customTitle || undefined,
            layout: {
              i: widgetId,
              x: pos.x,
              y: pos.y,
              w: placement.preferredW,
              h: placement.preferredH,
            },
            bindings: {},
            config: {
              panelScope: buildPanelScopeConfig({
                inheritSectionArea:
                  addPanelInheritSection && Boolean(section?.roomId),
                areaIds:
                  !addPanelInheritSection && addPanelAreaId ? [addPanelAreaId] : [],
                systemIds: addPanelSystemIds,
                groupIds: [],
                contentMode: addPanelContentMode,
                capabilityIds: addPanelCapabilityIds,
                cameraIds: addPanelCameraIds,
              }),
              ...(addPanelType === "panel.charts"
                ? { chartRange: "24h", chartPresetId: "line-basic" }
                : {}),
              appearance: { layout: "card" },
              ...statusLightConfig(addPanelStatusLight),
            },
          })
        );
        return sectionWithPanels(s, [...sectionPanels(s), panel]);
      })
    );
    setError(null);
    setAddPanelOpen(false);
  }

  function resolveAddPanelAreaIds(): string[] {
    const section = sections.find((s) => s.id === addPanelSectionId);
    if (addPanelInheritSection && section?.roomId) return [section.roomId];
    if (!addPanelInheritSection && addPanelAreaId) return [addPanelAreaId];
    return [];
  }

  useEffect(() => {
    if (!addPanelOpen || !addPanelShowsSystemFilter) {
      if (!addPanelOpen) return;
      setAddPanelScopeCapabilities([]);
    }
  }, [addPanelOpen, addPanelShowsSystemFilter]);

  useEffect(() => {
    if (!addPanelOpen || !addPanelShowsSystemFilter || !addPanelIsCore) {
      return;
    }
    const section = sections.find((s) => s.id === addPanelSectionId);
    const optionsScope = previewPanelScopeForItemOptions({
      inheritSectionArea: addPanelInheritSection,
      sectionRoomId: section?.roomId ?? null,
      areaId: addPanelAreaId,
      systemIds: addPanelSystemIds,
    });
    const controller = new AbortController();
    void dataRuntime
      .resolvePanel({
        panelKind: addPanelType,
        panelScope: optionsScope,
      }, controller.signal)
      .then((result) => {
        setAddPanelScopeCapabilities(result.capabilities);
        setAddPanelCapabilityIds((prev) =>
          prev.filter((id) => result.capabilities.some((c) => c.id === id))
        );
      })
      .catch(() => setAddPanelScopeCapabilities([]));
    return () => controller.abort();
  }, [
    addPanelOpen,
    addPanelShowsSystemFilter,
    addPanelIsCore,
    addPanelType,
    addPanelSectionId,
    addPanelInheritSection,
    addPanelAreaId,
    addPanelSystemIds,
    dataRuntime,
  ]);

  useEffect(() => {
    setAddPanelCapabilityIds([]);
    setAddPanelCameraIds([]);
    setAddPanelContentMode("manual");
  }, [addPanelType]);

  useEffect(() => {
    if (!addPanelOpen || !addPanelShowsCameraContent) {
      if (!addPanelOpen) return;
      setAddPanelCameras([]);
      return;
    }
    const areaIds = resolveAddPanelAreaIds();
    void api.cameras().then((res) => {
      const enabled = res.cameras.filter((c) => c.enabled);
      const scoped =
        areaIds.length > 0
          ? enabled.filter((c) => c.areaId && areaIds.includes(c.areaId))
          : enabled;
      setAddPanelCameras(
        scoped.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      );
      setAddPanelCameraIds((prev) => prev.filter((id) => scoped.some((c) => c.id === id)));
    });
  }, [
    addPanelOpen,
    addPanelShowsCameraContent,
    addPanelSectionId,
    addPanelInheritSection,
    addPanelAreaId,
    sections,
  ]);

  function removePanel(sectionId: string, panelId: string) {
    updateSection(sectionId, (s) =>
      sectionWithPanels(s, sectionPanels(s).filter((w) => w.id !== panelId))
    );
  }

  function movePanelToSection(
    fromSectionId: string,
    toSectionId: string,
    panelId: string
  ) {
    if (fromSectionId === toSectionId) return;
    setSections((prev) => {
      let moved: RuntimePanelInstance | null = null;
      const stripped = prev.map((s) => {
        if (s.id !== fromSectionId) return s;
        const w = sectionPanels(s).find((x) => x.id === panelId);
        if (!w) return s;
        moved = w;
        return sectionWithPanels(s, sectionPanels(s).filter((x) => x.id !== panelId));
      });
      if (!moved) return prev;
      return stripped.map((s) => {
        if (s.id !== toSectionId) return s;
        const pos = nextWidgetPlacement(sectionPanels(s), moved!.layout.w);
        const placed = enforcePanelPlacement({
          ...moved!,
          layout: {
            ...moved!.layout,
            x: pos.x,
            y: pos.y,
          },
        });
        return sectionWithPanels({ ...s, collapsed: false }, [...sectionPanels(s), placed]);
      });
    });
  }

  function updatePanel(
    sectionId: string,
    panelId: string,
    patch: Partial<PanelInstance>
  ) {
    updateSection(sectionId, (s) =>
      sectionWithPanels(
        s,
        sectionPanels(s).map((w) =>
          w.id === panelId ? mergeRuntimePanelPatch(w, patch) : w
        )
      )
    );
  }

  function enterEditMode() {
    const normalizedSections = sections.map((s) =>
      sectionWithPanels(s, sectionPanels(s).map(enforcePanelPlacement))
    );
    setSections(normalizedSections);
    setEditBaseline({
      name,
      tabIcon,
      showTabLabel,
      showSectionNav,
      gridCols,
      sections: JSON.parse(JSON.stringify(normalizedSections)) as RuntimeDashboardSection[],
    });
    setEditMode(true);
    setError(null);
  }

  function cancelEdit() {
    if (editBaseline) {
      setName(editBaseline.name);
      setTabIcon(editBaseline.tabIcon);
      setShowTabLabel(editBaseline.showTabLabel);
      setShowSectionNav(editBaseline.showSectionNav);
      setGridCols(editBaseline.gridCols);
      setSections(editBaseline.sections);
    } else if (dashboardId) {
      void api.getDashboard(dashboardId).then((d) => {
        loadDocument(d.dashboard.document, d.dashboard.name);
      });
    }
    setEditMode(false);
    setEditBaseline(null);
    setSettingsPanel(null);
    setAddPanelOpen(false);
    setError(null);
  }

  async function save(): Promise<boolean> {
    if (!dashboardId) return false;
    setSaving(true);
    setError(null);
    try {
      const document: DashboardDocument = serializeDashboardDocumentV3({
        name,
        tabIcon,
        showTabLabel,
        showSectionNav,
        gridCols,
        sections: sortSections(sections).map((s, i) => ({
          ...s,
          order: i,
          colSpan: normalizeSectionColSpan(s.colSpan),
        })),
      });
      await api.saveDashboard(dashboardId, { name, document });
      setEditBaseline(null);
      setEditMode(false);
      setSettingsPanel(null);
      setAddPanelOpen(false);
      setTabRefreshKey((k) => k + 1);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardErrorBoundary>
    <Stack
      spacing={2}
      sx={{
        // Room on the right for the rail. A side panel opens over the right edge; the dashboard stays put.
        pr: roomNav === "rail" ? "var(--nx-rail-width, 0px)" : 0,
      }}
    >
      {pageLoading && (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} spacing={1}>
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary">
            Loading dashboard…
          </Typography>
        </Stack>
      )}
      {!pageLoading && bootError && (
        <Alert severity="error">{bootError}</Alert>
      )}
      {!pageLoading && !bootError && (
      <>
      {(display.active && !display.tabs) || roomNav !== "tabs" ? null : (
      <DashboardTabBar
        variant={roomNav}
        activeId={dashboardId ?? undefined}
        refreshKey={tabRefreshKey}
        editMode={editMode}
        canEdit={canEditDashboards}
        canClearNotifications={hasPermission(permissions, "manageUsers", isAdmin)}
        onDashboardOptions={() => {
          if (!canEditDashboards) return;
          if (!editMode) enterEditMode();
        }}
      />
      )}

      {editMode && canEditDashboards && (
        // The edit bar: across the top of the page, beside the side menu; stays while scrolling.
        <PageBar>
          <ButtonRow
            direction="row"
            justifyContent="space-between"
            sx={{
              flex: 1,
              minWidth: 0,
              containerType: "inline-size",
              // A narrow screen shows Add section and Dashboard settings as icons (names on pointing).
              "@container (max-width: 560px)": {
                "& [data-nx-label]": { display: "none" },
                "& [data-nx-icon-button] .MuiButton-startIcon": { m: 0 },
                "& [data-nx-icon-button]": { minWidth: 40, px: 1 },
              },
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: "1 1 160px" }}>
              <DashIcon color="primary" sx={{ flexShrink: 0 }} />
              <Typography variant="body1" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                Editing dashboard:{" "}
                <Typography component="span" fontWeight="fontWeightBold" color="text.primary">
                  {name}
                </Typography>
              </Typography>
            </Stack>
            <ButtonRow direction="row">
              <Tooltip title="Add section">
                <Button variant="outlined" data-nx-icon-button="" aria-label="Add section" startIcon={<AddIcon />} onClick={addSection}>
                  <span data-nx-label="">Add section</span>
                </Button>
              </Tooltip>
              <Tooltip title="Dashboard settings">
                <Button
                  data-nx-icon-button=""
                  aria-label="Dashboard settings"
                  variant={settingsPanel?.type === "dashboard" ? "contained" : "outlined"}
                  startIcon={<SettingsOutlinedIcon />}
                  onClick={() => setSettingsPanel({ type: "dashboard", page: "this" })}
                >
                  <span data-nx-label="">Dashboard settings</span>
                </Button>
              </Tooltip>
              <Button variant="contained" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outlined" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
            </ButtonRow>
          </ButtonRow>
        </PageBar>
      )}

      <Dialog open={Boolean(leaveAsk)} onClose={() => setLeaveAsk(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Save the changes to “{name}”?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You changed this dashboard. Save the changes before going on, or leave them out.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setLeaveAsk(null)}>
            Stay here
          </Button>
          <Button
            variant="outlined"
            onClick={() => {
              const go = leaveAsk?.go;
              setLeaveAsk(null);
              cancelEdit();
              go?.();
            }}
          >
            Don't save
          </Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={async () => {
              const go = leaveAsk?.go;
              setLeaveAsk(null);
              if (await save()) go?.();
            }}
          >
            Save and continue
          </Button>
        </DialogActions>
      </Dialog>

      <DashboardSettingsPanel
        open={editMode && settingsPanel?.type === "dashboard"}
        page={settingsPanel?.type === "dashboard" ? settingsPanel.page : "this"}
        onPage={(page) => setSettingsPanel({ type: "dashboard", page })}
        onClose={() => setSettingsPanel(null)}
        dashboardId={dashboardId ?? undefined}
        name={name}
        onName={setName}
        icon={tabIcon}
        onIcon={setTabIcon}
        showName={showTabLabel}
        onShowName={setShowTabLabel}
        gridCols={gridCols}
        onGridCols={changePanelsAcross}
        sectionShortcuts={showSectionNav}
        onSectionShortcuts={setShowSectionNav}
        onDashboardsChanged={() => setTabRefreshKey((k) => k + 1)}
        onCurrentMeta={(meta) => {
          setName(meta.name);
          setTabIcon(meta.tabIcon);
          setShowTabLabel(meta.showTabLabel);
          setTabRefreshKey((k) => k + 1);
        }}
      />

      {(() => {
        const idx = settingsPanel?.type === "section" ? ordered.findIndex((x) => x.id === settingsPanel.id) : -1;
        const sec = idx >= 0 ? ordered[idx] : null;
        return (
          <SectionSettingsPanel
            section={
              editMode && sec
                ? {
                    id: sec.id,
                    title: sec.title,
                    icon: sec.icon,
                    showTitle: sec.showTitle,
                    colSpan: normalizeSectionColSpan(sec.colSpan),
                    panelCount: sectionPanelCount(sec),
                    isFirst: idx === 0,
                    isLast: idx === ordered.length - 1,
                    isOnly: ordered.length === 1,
                  }
                : null
            }
            onClose={() => setSettingsPanel(null)}
            onChange={(patch) => sec && updateSection(sec.id, patch)}
            onMove={(dir) => sec && moveSection(sec.id, dir)}
            onDelete={() => sec && removeSection(sec.id)}
          />
        );
      })()}

      {error && <Alert severity="error">{error}</Alert>}

      {showSectionNav && ordered.length > 1 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {ordered.map((s) => {
            const SecIcon = getDashboardIcon(s.icon);
            return (
              <Chip
                key={s.id}
                icon={<SecIcon />}
                label={s.title}
                clickable
                color={s.collapsed ? "default" : "primary"}
                variant={s.collapsed ? "outlined" : "filled"}
                onClick={() => {
                  updateSection(s.id, { collapsed: false });
                  requestAnimationFrame(() => {
                    document
                      .getElementById(`dash-section-${s.id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              />
            );
          })}
        </Stack>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: 2,
          alignItems: "start",
        }}
      >
        {ordered.map((section) => {
          const span = isNarrow ? 12 : normalizeSectionColSpan(section.colSpan);
          // A section without its title bar shows just its frame round the panels (always open).
          const titleHidden = !editMode && section.showTitle === false;
          const SecIcon = getDashboardIcon(section.icon);
          return (
            // The section's place in the grid; the Look's section frame is drawn over its edges
            // (inside the room the section keeps for it with sectionInset).
            <Box key={section.id} sx={{ gridColumn: `span ${span}`, minWidth: 0, position: "relative", scrollMarginTop: 16 }}>
            <Accordion
              id={`dash-section-${section.id}`}
              expanded={titleHidden || !section.collapsed}
              onChange={(_e, expanded) =>
                updateSection(section.id, { collapsed: !expanded })
              }
              disableGutters
              data-nx-role="section"
              sx={[
                {
                  overflow: "hidden",
                  "&:before": { display: "none" },
                  minWidth: 0,
                },
                // The Look's dashboard section (border, corners, fill, shadow) and the room it keeps for a frame.
                sectionSx(gradientActive),
                // The section whose settings are open is outlined.
                settingsPanel?.type === "section" && settingsPanel.id === section.id
                  ? (t) => ({ boxShadow: `0 0 0 2px ${t.palette.primary.main}` })
                  : {},
              ]}
            >
              {/* The section's header (the Accordion's first child): name, panel count, and its buttons. */}
              <Box sx={{ display: titleHidden ? "none" : "block", px: 2, py: 1.25 }}>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  sx={{ width: "100%", minWidth: 0, containerType: "inline-size" }}
                >
                  <SecIcon color="primary" fontSize="small" />
                  <Typography variant="h6" noWrap sx={{ minWidth: 0 }}>
                    {section.title || (editMode ? "Untitled section" : "")}
                  </Typography>
                  <Typography variant="caption" sx={{ flexShrink: 0, color: "text.secondary" }}>
                    {sectionContentSummary(sectionPanels(section))}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {editMode && (
                    <ButtonRow
                      direction="row"
                      flexWrap="nowrap"
                      sx={{
                        flexShrink: 0,
                        // A narrow section shows the buttons' icons only (their names show on pointing).
                        "@container (max-width: 520px)": {
                          "& [data-nx-label]": { display: "none" },
                          "& .MuiButton-startIcon": { m: 0 },
                          "& .MuiButton-root": { minWidth: 40, px: 1 },
                        },
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Tooltip title="Add a panel to this section">
                        <Button variant="outlined" aria-label="Add panel" startIcon={<AddIcon />} onClick={() => openAddPanel(section.id)}>
                          <span data-nx-label="">Add panel</span>
                        </Button>
                      </Tooltip>
                      <Tooltip title="Name, icon, width, position, delete">
                        <Button
                          aria-label="Section settings"
                          variant={settingsPanel?.type === "section" && settingsPanel.id === section.id ? "contained" : "outlined"}
                          startIcon={<SettingsOutlinedIcon />}
                          onClick={() => setSettingsPanel({ type: "section", id: section.id })}
                        >
                          <span data-nx-label="">Section settings</span>
                        </Button>
                      </Tooltip>
                    </ButtonRow>
                  )}
                  {/* Fold / open: a real button like every other, with its name. */}
                  <Tooltip title={section.collapsed ? "Open this section" : "Fold this section"}>
                    <Button
                      variant="outlined"
                      aria-label={section.collapsed ? "Open this section" : "Fold this section"}
                      aria-expanded={!section.collapsed}
                      aria-controls={`dash-section-body-${section.id}`}
                      onClick={() => updateSection(section.id, { collapsed: !section.collapsed })}
                      sx={{ minWidth: 36, width: 36, height: 36, p: 0, flexShrink: 0 }}
                    >
                      {section.collapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </Button>
                  </Tooltip>
                </Stack>
              </Box>
              <AccordionDetails id={`dash-section-body-${section.id}`} sx={{ pt: titleHidden ? 2 : 0, px: 2, pb: 2 }}>
                <SectionGrid
                  gridCols={gridCols}
                  sectionId={section.id}
                  sectionRoomId={section.roomId ?? null}
                  sectionTitle={section.title}
                  panels={sectionPanels(section)}
                  capabilities={capabilities}
                  cameras={cameras}
                  editMode={editMode}
                  onAddPanel={() => openAddPanel(section.id)}
                  onStartAdding={
                    canEditDashboards && !display.active
                      ? () => {
                          enterEditMode();
                          openAddPanel(section.id);
                        }
                      : undefined
                  }
                  activity={section.collapsed ? "collapsed" : "visible"}
                  onLayoutChange={onLayoutChange}
                  onRemovePanel={removePanel}
                  onUpdatePanel={updatePanel}
                  onMovePanel={movePanelToSection}
                  moveTargets={ordered.filter((x) => x.id !== section.id).map((x) => ({ id: x.id, title: x.title }))}
                  onCapabilityState={applyLive}
                />
              </AccordionDetails>
            </Accordion>
            <LookDecor slot="section" />
            </Box>
          );
        })}
      </Box>

      {/* Dock and rail are fixed on screen; drawn last so they take no room above the dashboard.
          They stay while editing: moving to another dashboard asks first when there are unsaved changes. */}
      {roomNav !== "tabs" && !(display.active && !display.tabs) ? (
        <DashboardTabBar
          variant={roomNav}
          activeId={dashboardId ?? undefined}
          refreshKey={tabRefreshKey}
          editMode={editMode}
          canEdit={canEditDashboards}
          canClearNotifications={hasPermission(permissions, "manageUsers", isAdmin)}
          onDashboardOptions={() => {
            if (!canEditDashboards) return;
            if (!editMode) enterEditMode();
          }}
        />
      ) : null}

      <SidePanel
        open={editMode && addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        title="Add panel"
        footer={
          <ButtonRow direction="row">
            <Button variant="outlined" fullWidth onClick={() => setAddPanelOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              fullWidth
              disabled={!addPanelValidation.ok}
              onClick={() => {
                try {
                  addPanel();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add panel");
                }
              }}
            >
              Add panel
            </Button>
          </ButtonRow>
        }
      >
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="panel-section-target">Section</InputLabel>
              <Select
                labelId="panel-section-target"
                label="Section"
                value={addPanelSectionId || ordered[0]?.id || ""}
                onChange={(e) => {
                  const sid = e.target.value;
                  setAddPanelSectionId(sid);
                  const sec = sections.find((s) => s.id === sid);
                  setAddPanelInheritSection(Boolean(sec?.roomId));
                }}
              >
                {ordered.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <AddPanelTypePicker
              catalog={addPanelCatalog}
              value={addPanelType}
              onChange={(id) => {
                setAddPanelType(id);
                if (isCorePanelCatalogType(id)) {
                  setAddPanelSystemIds([]);
                }
              }}
            />

            <TextField
              label="Title (optional)"
              size="small"
              fullWidth
              value={addPanelTitle}
              onChange={(e) => setAddPanelTitle(e.target.value)}
              helperText="Shown above the panel on the dashboard when set"
            />

            {addPanelIsCore && (
              <>
                {addPanelShowsAreaScope &&
                  sections.find((s) => s.id === addPanelSectionId)?.roomId && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={addPanelInheritSection}
                        onChange={(e) => setAddPanelInheritSection(e.target.checked)}
                      />
                    }
                    label={`Use this section's ${AREA.singular.toLowerCase()}`}
                  />
                )}

                {addPanelShowsAreaScope &&
                  (!sections.find((s) => s.id === addPanelSectionId)?.roomId ||
                    !addPanelInheritSection) && (
                  <FormControl fullWidth>
                    <InputLabel id="panel-area-target">{AREA.singular}</InputLabel>
                    <Select
                      labelId="panel-area-target"
                      label={AREA.singular}
                      value={addPanelAreaId}
                      onChange={(e) => setAddPanelAreaId(e.target.value)}
                    >
                      <MenuItem value="">All {AREA.plural.toLowerCase()}</MenuItem>
                      {addPanelAreas.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {addPanelShowsSystemFilter && (
                  <PanelContentFields
                    panelKind={addPanelType}
                    capabilityIds={addPanelCapabilityIds}
                    onCapabilityIdsChange={setAddPanelCapabilityIds}
                    options={addPanelScopeCapabilities}
                  />
                )}

                {addPanelShowsCameraContent && (
                  <PanelCameraContentFields
                    cameraIds={addPanelCameraIds}
                    onCameraIdsChange={setAddPanelCameraIds}
                    options={addPanelCameras}
                  />
                )}

                {!addPanelValidation.ok && (
                  <Typography variant="caption" color="error" role="alert">
                    {addPanelValidation.message}
                  </Typography>
                )}

              </>
            )}

            {!addPanelIsCore && hasBindingSlots && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">{PLUGIN_ITEM_PICKER_HEADING}</Typography>
                <SlotBindingFields
                  slots={bindingSlots}
                  capabilities={capabilities}
                  values={addPanelSlotValues}
                  onChange={(key, id) =>
                    setAddPanelSlotValues((prev) => ({ ...prev, [key]: id }))
                  }
                />
              </Stack>
            )}

            {/* Every panel that shows readings gets a status light; readings without limits can be given them here. */}
            <StatusLightEditorSection
              value={addPanelStatusLight}
              onChange={setAddPanelStatusLight}
              readings={addPanelReadings}
            />
          </Stack>
      </SidePanel>
      </>
      )}
    </Stack>
    </DashboardErrorBoundary>
  );
}

/** One shared live/data lifecycle per mounted Dashboard session. */
export function DashboardPage() {
  return (
    <DashboardDataRuntimeProvider>
      <SidePanelProvider>
        <DashboardPageContent />
      </SidePanelProvider>
    </DashboardDataRuntimeProvider>
  );
}
