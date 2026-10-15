import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useParams } from "react-router-dom";
import { type Layout } from "react-grid-layout";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  IconButton,
  InputLabel,
  MenuItem,
  Popover,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TabRoundedIcon from "@mui/icons-material/TabRounded";
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
  sectionColSpanLabel,
  sortSections,
  type SectionColSpan,
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
import { ManageDashboardsPanel } from "../components/ManageDashboardsPanel";
import { DashboardErrorBoundary } from "../components/DashboardErrorBoundary";
import { useConfirm } from "../components/confirm";
import { DashboardIconPicker } from "../components/DashboardIconPicker";
import { getDashboardIcon } from "../lib/dashboard-icons";
import { useShellAuth } from "../skins/useShellAuth";
import { hasPermission } from "../lib/permissions";
import { chromeSurfaceSx } from "../skins/surfaceStyles";
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
  const canEditDashboards = hasPermission(
    permissions,
    "editDashboards",
    isAdmin
  );
  const { confirm } = useConfirm();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const gradientActive = useGradientActive();
  const [name, setName] = useState("Dashboard");
  const [tabIcon, setTabIcon] = useState("dashboard");
  const [showTabLabel, setShowTabLabel] = useState(true);
  const [showSectionNav, setShowSectionNav] = useState(false);
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
  const [iconPickerSectionId, setIconPickerSectionId] = useState<string | null>(null);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<HTMLElement | null>(null);
  const [tabRefreshKey, setTabRefreshKey] = useState(0);
  const [tabSettingsOpen, setTabSettingsOpen] = useState(false);
  const [manageDashboardsOpen, setManageDashboardsOpen] = useState(false);
  const [editBaseline, setEditBaseline] = useState<{
    name: string;
    tabIcon: string;
    showTabLabel: boolean;
    showSectionNav: boolean;
    sections: RuntimeDashboardSection[];
  } | null>(null);
  const [panelDrag, setPanelDrag] = useState<{
    panelId: string;
    fromSectionId: string;
  } | null>(null);

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
            setBootError("No dashboards yet — open Manage dashboards to create one.");
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

  /** Show the readable address (`/` or `/d/<name>`), also for old `/dashboards/<id>` links. */
  useEffect(() => {
    if (pageLoading || !dashboardId) return;
    let cancelled = false;
    void api.dashboards().then((res) => {
      if (cancelled) return;
      const path = dashboardPaths(res.dashboards).get(dashboardId);
      if (path && path !== window.location.pathname) {
        window.history.replaceState(null, "", path);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pageLoading, dashboardId]);


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
  }

  function removeSection(sectionId: string) {
    setSections((prev) => {
      if (prev.length <= 1) {
        setError("Keep at least one section");
        return prev;
      }
      return prev.filter((s) => s.id !== sectionId);
    });
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

  function handleSectionPanelDrop(e: DragEvent, toSectionId: string) {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData("application/x-nexternel-panel");
      const parsed = JSON.parse(raw) as { panelId?: string; sectionId?: string };
      if (
        typeof parsed.panelId === "string" &&
        typeof parsed.sectionId === "string" &&
        parsed.sectionId !== toSectionId
      ) {
        movePanelToSection(parsed.sectionId, toSectionId, parsed.panelId);
      }
    } catch {
      /* ignore */
    }
    setPanelDrag(null);
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
      setSections(editBaseline.sections);
    } else if (dashboardId) {
      void api.getDashboard(dashboardId).then((d) => {
        loadDocument(d.dashboard.document, d.dashboard.name);
      });
    }
    setEditMode(false);
    setEditBaseline(null);
    setTabSettingsOpen(false);
    setManageDashboardsOpen(false);
    setError(null);
  }

  async function save() {
    if (!dashboardId) return;
    setSaving(true);
    setError(null);
    try {
      const document: DashboardDocument = serializeDashboardDocumentV3({
        name,
        tabIcon,
        showTabLabel,
        showSectionNav,
        sections: sortSections(sections).map((s, i) => ({
          ...s,
          order: i,
          colSpan: normalizeSectionColSpan(s.colSpan),
        })),
      });
      await api.saveDashboard(dashboardId, { name, document });
      setEditBaseline(null);
      setEditMode(false);
      setTabSettingsOpen(false);
      setManageDashboardsOpen(false);
      setTabRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardErrorBoundary>
    <Stack spacing={2}>
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
      <DashboardTabBar
        activeId={dashboardId ?? undefined}
        refreshKey={tabRefreshKey}
        editMode={editMode}
        canEdit={canEditDashboards}
        onDashboardOptions={() => {
          if (!canEditDashboards) return;
          if (!editMode) enterEditMode();
        }}
      />

      {editMode && canEditDashboards && (
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Dashboard Options
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" onClick={addSection}>
                Add section
              </Button>
              <Button
                variant="outlined"
                startIcon={<TabRoundedIcon />}
                onClick={() => setTabSettingsOpen(true)}
              >
                Tab settings
              </Button>
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={() => setManageDashboardsOpen(true)}
              >
                Manage dashboards
              </Button>
              <Button variant="contained" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button variant="outlined" color="inherit" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}

      <Dialog
        open={tabSettingsOpen}
        onClose={() => setTabSettingsOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>This tab (horizontal menu)</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              size="small"
              label="Tab name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText="Shown on the top dashboard tabs — Save to keep changes"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showTabLabel}
                  onChange={(e) => setShowTabLabel(e.target.checked)}
                />
              }
              label="Show name on tab (off = icon only)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showSectionNav}
                  onChange={(e) => setShowSectionNav(e.target.checked)}
                />
              }
              label="Show section quick-jump row"
            />
            <DashboardIconPicker value={tabIcon} onChange={setTabIcon} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTabSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={manageDashboardsOpen}
        onClose={() => setManageDashboardsOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Manage dashboards</DialogTitle>
        <DialogContent>
          <ManageDashboardsPanel
            compact
            currentDashboardId={dashboardId ?? undefined}
            onDashboardsChanged={() => {
              setTabRefreshKey((k) => k + 1);
            }}
            onCurrentTabMeta={(meta) => {
              setName(meta.name);
              setTabIcon(meta.tabIcon);
              setShowTabLabel(meta.showTabLabel);
              setTabRefreshKey((k) => k + 1);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageDashboardsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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
        {ordered.map((section, index) => {
          const span = isNarrow ? 12 : normalizeSectionColSpan(section.colSpan);
          const SecIcon = getDashboardIcon(section.icon);
          return (
            <Accordion
              key={section.id}
              id={`dash-section-${section.id}`}
              expanded={!section.collapsed}
              onChange={(_e, expanded) =>
                updateSection(section.id, { collapsed: !expanded })
              }
              onDragOver={(e) => {
                if (
                  !editMode ||
                  !panelDrag ||
                  panelDrag.fromSectionId === section.id
                ) {
                  return;
                }
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => handleSectionPanelDrop(e, section.id)}
              disableGutters
              sx={{
                gridColumn: `span ${span}`,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                scrollMarginTop: 16,
                overflow: "hidden",
                ...chromeSurfaceSx(gradientActive),
                "&:before": { display: "none" },
                boxShadow: (t) =>
                  gradientActive
                    ? "none"
                    : t.palette.mode === "dark"
                      ? "none"
                      : "0 1px 3px rgba(0,0,0,0.06)",
                minWidth: 0,
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ width: "100%", pr: 1 }}
                  onClick={(e) => {
                    if (editMode) e.stopPropagation();
                  }}
                >
                  {editMode ? (
                    <IconButton
                      size="small"
                      aria-label="Section icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIconPickerSectionId(section.id);
                        setIconPickerAnchor(e.currentTarget);
                      }}
                    >
                      <SecIcon fontSize="small" />
                    </IconButton>
                  ) : (
                    <SecIcon color="primary" fontSize="small" />
                  )}
                  {editMode ? (
                    <>
                      <TextField
                        size="small"
                        label="Section"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ width: { xs: "100%", sm: 220 }, maxWidth: 280, flexShrink: 0 }}
                      />
                      <Tooltip title="Delete this section and all panels inside it">
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          sx={{ flexShrink: 0 }}
                          onClick={() => {
                            void (async () => {
                              const panelCount = sectionPanelCount(section);
                              const ok = await confirm({
                                title: "Remove this section?",
                                message:
                                  `Remove “${section.title}” and ${panelCount} panel${panelCount === 1 ? "" : "s"} inside it? Save the dashboard to keep this change.`,
                                confirmLabel: "Remove this section",
                              });
                              if (ok) removeSection(section.id);
                            })();
                          }}
                        >
                          Remove this Section
                        </Button>
                      </Tooltip>
                    </>
                  ) : (
                    <Typography variant="h6" sx={{ flex: 1 }} noWrap>
                      {section.title}
                    </Typography>
                  )}
                  <Box sx={{ flex: 1, minWidth: 8 }} />
                  <Typography
                    variant="caption"
                    sx={{ flexShrink: 0, color: "primary.main", fontWeight: 500 }}
                  >
                    {sectionContentSummary(sectionPanels(section))}
                  </Typography>
                  {editMode && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel id={`span-${section.id}`}>Width</InputLabel>
                        <Select
                          labelId={`span-${section.id}`}
                          label="Width"
                          value={normalizeSectionColSpan(section.colSpan)}
                          onChange={(e) =>
                            updateSection(section.id, {
                              colSpan: Number(e.target.value) as SectionColSpan,
                            })
                          }
                        >
                          {([12, 6, 4, 3] as SectionColSpan[]).map((n) => (
                            <MenuItem key={n} value={n}>
                              {sectionColSpanLabel(n)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Tooltip title="Move section up on the page">
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Move section up"
                            disabled={index === 0}
                            onClick={() => moveSection(section.id, -1)}
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move section down on the page">
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Move section down"
                            disabled={index === ordered.length - 1}
                            onClick={() => moveSection(section.id, 1)}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Add a panel to this section">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openAddPanel(section.id)}
                        >
                          Add Panel
                        </Button>
                      </Tooltip>
                    </Stack>
                  )}
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, px: 2, pb: 2 }}>
                <SectionGrid
                  sectionId={section.id}
                  sectionRoomId={section.roomId ?? null}
                  sectionTitle={section.title}
                  panels={sectionPanels(section)}
                  capabilities={capabilities}
                  cameras={cameras}
                  editMode={editMode}
                  activity={section.collapsed ? "collapsed" : "visible"}
                  onLayoutChange={onLayoutChange}
                  onRemovePanel={removePanel}
                  onUpdatePanel={updatePanel}
                  onMovePanel={movePanelToSection}
                  panelDrag={panelDrag}
                  onPanelDragStart={(sid, pid) =>
                    setPanelDrag({ fromSectionId: sid, panelId: pid })
                  }
                  onPanelDragEnd={() => setPanelDrag(null)}
                  onCapabilityState={applyLive}
                />
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      <Popover
        open={Boolean(iconPickerAnchor) && Boolean(iconPickerSectionId)}
        anchorEl={iconPickerAnchor}
        onClose={() => {
          setIconPickerAnchor(null);
          setIconPickerSectionId(null);
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <DashboardIconPicker
            dense
            value={
              ordered.find((s) => s.id === iconPickerSectionId)?.icon ??
              DEFAULT_SECTION_ICON
            }
            onChange={(iconId) => {
              if (iconPickerSectionId) {
                updateSection(iconPickerSectionId, { icon: iconId });
              }
              setIconPickerAnchor(null);
              setIconPickerSectionId(null);
            }}
          />
        </Box>
      </Popover>

      <Dialog
        open={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        fullWidth
        maxWidth="sm"
        keepMounted={false}
      >
        <DialogTitle>Add Panel</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddPanelOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!addPanelValidation.ok}
            onClick={() => {
              try {
                addPanel();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not add panel");
              }
            }}
          >
            Add Panel
          </Button>
        </DialogActions>
      </Dialog>
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
      <DashboardPageContent />
    </DashboardDataRuntimeProvider>
  );
}
