import { useEffect, useMemo, useRef, useState } from "react";
import { readPanelStatusLight, type PanelStatusLight } from "@nexternel/domain";
import { StatusLightEditorSection } from "../../components/status-light/StatusLightFields";

import {

  Button,

  Checkbox,

  Drawer,

  FormControl,

  FormControlLabel,

  InputLabel,

  MenuItem,

  Select,

  Stack,

  Typography,

} from "@mui/material";

import type { PanelContentMode } from "@nexternel/domain";

import { api, type CameraRecord, type HistoryRange, type ResolvedPanelCapability, type WidgetInstance } from "../../api";

import { PanelCameraContentFields } from "../../components/PanelCameraContentFields";

import { PanelContentFields } from "../../components/PanelContentFields";

import { PanelChartPresetFields } from "../../components/PanelChartPresetFields";

import { AREA } from "../../lib/area-labels";

import { loadSystemsInScope } from "../../lib/panel-catalog";
import { useDashboardDataRuntime } from "../../lib/dashboard-data-runtime";

import {

  readPanelAppearanceLayout,
  readPanelItemDirection,
  readPanelItemStyle,

  type PanelAppearanceLayout,
  type PanelItemDirection,
  type PanelItemStyle,

} from "../../lib/panel-appearance";

import {
  readPanelChartMinMax,
  readPanelChartPreset,
  readPanelChartRange,
} from "../../lib/panel-chart-config";

import { normalizePanelKind } from "../../lib/panel-kind";

import {

  buildPanelScopeConfig,

  previewPanelScopeForItemOptions,

  previewPanelScopeFromEditorFields,

  readPanelContentMode,

} from "../../lib/panel-scope";

import { panelUsesAreaScope, panelUsesCapabilityScope } from "@nexternel/domain";

import { readPanelScope } from "./registry";
import {
  readPanelItemDisplay,
  writePanelItemDisplay,
  type ItemNamesMode,
  type PanelItemDisplay,
} from "../../lib/panel-item-display";
import { panelItemLabel } from "../../lib/panel-heading";
import { readTitleIcon, writeTitleIcon } from "../../lib/panel-title-icon";
import { PanelTitleFields, type AutomaticTitle } from "../../components/PanelTitleFields";



type Props = {

  open: boolean;

  widget: WidgetInstance;

  sectionRoomId?: string | null;

  sectionTitle?: string;

  onClose: () => void;

  onSave: (patch: Partial<WidgetInstance>) => void;
  /** The title and icon the panel shows when none are set. */
  automatic?: AutomaticTitle;
};



const CHART_RANGES: HistoryRange[] = ["1h", "6h", "24h", "7d"];

type EditorScope = {
  inheritSectionArea?: boolean;
  areaIds?: string[];
  systemIds?: string[];
  groupIds?: string[];
  capabilityIds?: string[];
  cameraIds?: string[];
  contentMode?: PanelContentMode;
};

function editorScope(widget: WidgetInstance): EditorScope {
  return readPanelScope(widget) as EditorScope;
}

export function PanelWidgetEditor({

  open,

  widget,

  sectionRoomId,

  sectionTitle,

  onClose,

  onSave,

  automatic = { title: null, icon: { iconId: "auto", kind: null } },

}: Props) {

  const dataRuntime = useDashboardDataRuntime();

  const panelKind = normalizePanelKind(widget.type);

  const isCharts = panelKind === "panel.charts";
  const showArrange = panelKind === "panel.status" || panelKind === "panel.controls";

  const isCamera = panelKind === "panel.camera";
  /** Panels that list items: their names and icons follow the Items settings. */
  const showItemDisplay = showArrange || isCharts || isCamera;

  const existing = editorScope(widget);
  const groupIdsKey = (existing.groupIds ?? []).join("|");

  const supportsAreaScope = panelUsesAreaScope(widget.type);

  const showSystemFilter = panelUsesCapabilityScope(widget.type);

  const showCameraContent = isCamera;

  const [title, setTitle] = useState(widget.title ?? "");

  const [inheritSection, setInheritSection] = useState(

    existing.inheritSectionArea ?? Boolean(sectionRoomId)

  );

  const [areaId, setAreaId] = useState(existing.areaIds?.[0] ?? "");

  const [systemIds, setSystemIds] = useState<string[]>(existing.systemIds ?? []);

  const [contentMode, setContentMode] = useState<PanelContentMode>(

    readPanelContentMode(existing)

  );
  /**
   * Hand-picked panels show exactly the picked items, so the pick list offers every item
   * and no Area filter applies (an Area here used to hide picked items with no way back).
   */
  const pickFromAll = contentMode === "manual";
  const showAreaScope = supportsAreaScope && !pickFromAll;
  const filterAreaId = pickFromAll ? "" : areaId;
  const filterInherit = pickFromAll ? false : inheritSection;
  const filterSystemIds = pickFromAll ? [] : systemIds;

  const [capabilityIds, setCapabilityIds] = useState<string[]>(existing.capabilityIds ?? []);

  const [cameraIds, setCameraIds] = useState<string[]>(existing.cameraIds ?? []);

  const [appearanceLayout, setAppearanceLayout] = useState<PanelAppearanceLayout>(

    readPanelAppearanceLayout(widget.config)

  );

  const [itemDirection, setItemDirection] = useState<PanelItemDirection>(
    readPanelItemDirection(widget.config)
  );

  const [itemStyle, setItemStyle] = useState<PanelItemStyle>(readPanelItemStyle(widget.config));
  const [itemDisplay, setItemDisplay] = useState<PanelItemDisplay>(readPanelItemDisplay(widget.config));
  const [titleIcon, setTitleIcon] = useState(readTitleIcon(widget.config));
  const [statusLight, setStatusLight] = useState<PanelStatusLight>(readPanelStatusLight(widget.config));

  const [chartRange, setChartRange] = useState<HistoryRange>(readPanelChartRange(widget.config));

  const [chartPresetId, setChartPresetId] = useState(readPanelChartPreset(widget.config));

  const [chartMinStr, setChartMinStr] = useState("");

  const [chartMaxStr, setChartMaxStr] = useState("");

  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);

  const [scopeCapabilities, setScopeCapabilities] = useState<ResolvedPanelCapability[]>([]);

  const itemCount = isCamera ? cameraIds.length : capabilityIds.length;

  /** "Hallway Monitor CO2" → short "CO2": a real example for the Item names choices. */
  const nameExample = useMemo(() => {
    if (isCamera) return null;
    const picked = capabilityIds
      .map((id) => scopeCapabilities.find((c) => c.id === id))
      .filter((c): c is ResolvedPanelCapability => Boolean(c));
    if (picked.length < 2) return null;
    const shared = (values: (string | null | undefined)[]) => {
      const first = values[0]?.trim();
      return first && values.every((v) => v?.trim().toLowerCase() === first.toLowerCase()) ? first : null;
    };
    const prefix = shared(picked.map((c) => c.deviceName)) ?? shared(picked.map((c) => c.areaName));
    // Prefer an item whose short name differs, so the two choices show what they mean.
    const examples = picked.map((c) => ({ full: c.name, short: panelItemLabel(c.name, prefix) }));
    return examples.find((e) => e.short !== e.full) ?? examples[0]!;
  }, [isCamera, capabilityIds, scopeCapabilities]);

  const fillFromAuto = useRef(false);

  const [scopeCameras, setScopeCameras] = useState<CameraRecord[]>([]);



  const previewScope = useMemo(

    () =>

      previewPanelScopeFromEditorFields({

        inheritSectionArea: filterInherit,

        sectionRoomId: sectionRoomId ?? null,

        areaId: filterAreaId,

        systemIds: filterSystemIds,

        groupIds: existing.groupIds ?? [],

        contentMode,

        capabilityIds,

        cameraIds,

      }),

    [inheritSection, sectionRoomId, areaId, systemIds, groupIdsKey, contentMode, capabilityIds, cameraIds]

  );



  const previewScopeKey = `${previewScope.contentMode}|${previewScope.areaIds.join(",")}|${previewScope.systemIds.join(",")}|${previewScope.groupIds.join(",")}|${previewScope.capabilityIds.join(",")}|${previewScope.cameraIds.join(",")}`;



  useEffect(() => {

    if (!open) return;

    const scope = editorScope(widget);

    setTitle(widget.title ?? "");

    setInheritSection(scope.inheritSectionArea ?? Boolean(sectionRoomId));

    setAreaId(scope.areaIds?.[0] ?? "");

    setSystemIds(scope.systemIds ?? []);

    const mode = readPanelContentMode(scope);

    fillFromAuto.current = mode === "auto";

    setContentMode("manual");

    setCapabilityIds(mode === "auto" ? [] : (scope.capabilityIds ?? []));

    setCameraIds(scope.cameraIds ?? []);

    setAppearanceLayout(readPanelAppearanceLayout(widget.config));
    setItemDirection(readPanelItemDirection(widget.config));
    setItemStyle(readPanelItemStyle(widget.config));
    setItemDisplay(readPanelItemDisplay(widget.config));
    setTitleIcon(readTitleIcon(widget.config));
    setStatusLight(readPanelStatusLight(widget.config));

    setChartRange(readPanelChartRange(widget.config));

    const chartBounds = readPanelChartMinMax(widget.config);

    setChartPresetId(readPanelChartPreset(widget.config));

    setChartMinStr(chartBounds.min !== undefined ? String(chartBounds.min) : "");

    setChartMaxStr(chartBounds.max !== undefined ? String(chartBounds.max) : "");

    void api.rooms().then((r) => {

      setAreas(r.rooms.map((room) => ({ id: room.id, name: room.name })));

    });

  }, [open, widget, sectionRoomId]);



  useEffect(() => {

    if (!open) return;

    void loadSystemsInScope(previewScope.areaIds).then((systems) => {

      setSystemIds((prev) => prev.filter((id) => systems.some((s) => s.id === id)));

    });

  }, [open, previewScopeKey]);



  useEffect(() => {

    if (!open || !showSystemFilter) return;

    const optionsScope = previewPanelScopeForItemOptions({

      inheritSectionArea: filterInherit,

      sectionRoomId: sectionRoomId ?? null,

      areaId: filterAreaId,

      systemIds: filterSystemIds,

      groupIds: existing.groupIds ?? [],

    });

    const controller = new AbortController();

    void dataRuntime

      .resolvePanel({

        panelKind: widget.type,

        panelScope: optionsScope,

      }, controller.signal)

      .then((result) => {

        setScopeCapabilities(result.capabilities);

        setCapabilityIds((prev) => {

          if (fillFromAuto.current) {

            fillFromAuto.current = false;

            return result.capabilities.map((cap) => cap.id);

          }

          return prev.filter((id) => result.capabilities.some((c) => c.id === id));

        });

      })

      .catch(() => setScopeCapabilities([]));

    return () => controller.abort();

  }, [open, showSystemFilter, widget.type, previewScopeKey, inheritSection, sectionRoomId, areaId, systemIds, groupIdsKey, dataRuntime]);



  useEffect(() => {

    if (!open || !showCameraContent) return;

    void api

      .cameras()

      .then((r) => {

        let list = r.cameras.filter((c) => c.enabled);

        if (previewScope.areaIds.length > 0) {

          list = list.filter((c) => c.areaId && previewScope.areaIds.includes(c.areaId));

        }

        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

        setScopeCameras(list);

        setCameraIds((prev) => {

          if (fillFromAuto.current) {

            fillFromAuto.current = false;

            return list.map((cam) => cam.id);

          }

          return prev.filter((id) => list.some((c) => c.id === id));

        });

      })

      .catch(() => setScopeCameras([]));

  }, [open, showCameraContent, previewScopeKey]);



  function handleSave() {

    const areaIds =

      !inheritSection && areaId

        ? [areaId]

        : inheritSection

          ? []

          : existing.areaIds ?? [];

    const prevAppearance =

      widget.config?.appearance && typeof widget.config.appearance === "object"

        ? (widget.config.appearance as Record<string, unknown>)

        : {};

    const chartMin = chartMinStr.trim() ? Number(chartMinStr) : undefined;

    const chartMax = chartMaxStr.trim() ? Number(chartMaxStr) : undefined;

    const nextConfig: Record<string, unknown> = {
      ...widget.config,
      panelScope: buildPanelScopeConfig({
        inheritSectionArea: filterInherit,
        areaIds: pickFromAll ? [] : areaIds,
        systemIds: filterSystemIds,
        groupIds: existing.groupIds ?? [],
        contentMode,
        capabilityIds,
        cameraIds,
      }),
      appearance: {
        ...prevAppearance,
        layout: appearanceLayout,
        direction: itemDirection,
        itemStyle,
      },
    };

    if (statusLight.style === "default" && statusLight.position === "default" && statusLight.blink === "default") {
      delete nextConfig.statusLight;
    } else {
      nextConfig.statusLight = statusLight;
    }

    if (isCharts) {
      nextConfig.chartRange = chartRange;
      nextConfig.chartPresetId = chartPresetId;
      if (chartMin !== undefined && Number.isFinite(chartMin)) {
        nextConfig.chartMin = chartMin;
      } else {
        delete nextConfig.chartMin;
      }
      if (chartMax !== undefined && Number.isFinite(chartMax)) {
        nextConfig.chartMax = chartMax;
      } else {
        delete nextConfig.chartMax;
      }
    }

    const savedConfig = writeTitleIcon(
      showItemDisplay
        ? writePanelItemDisplay(nextConfig, itemDisplay, isCamera ? cameraIds : capabilityIds)
        : nextConfig,
      titleIcon
    );

    onSave({
      title: title.trim() || undefined,
      config: savedConfig,
    });

    onClose();

  }



  const heading =
    panelKind === "panel.status"
      ? "Edit status"
      : panelKind === "panel.controls"
        ? "Edit controls"
        : panelKind === "panel.charts"
          ? "Edit charts"
          : panelKind === "panel.camera"
            ? "Edit cameras"
            : "Edit panel";

  return (

    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 400 }, p: 2 } }}
    >

      <Stack spacing={2} sx={{ height: "100%" }}>

        <Typography variant="h6">{heading}</Typography>

        <Typography variant="caption" color="text.secondary">
          {panelKind === "panel.status"
            ? "Choose the readings. Arrange puts them in a row or stacks them."
            : panelKind === "panel.controls"
              ? "Choose the switches. Arrange puts them in a row or stacks them."
              : "Optional title. Shown above the panel when set."}
        </Typography>

        <Stack spacing={2} sx={{ mt: 1 }}>

          <PanelTitleFields
            title={title}
            onTitleChange={setTitle}
            icon={titleIcon}
            onIconChange={setTitleIcon}
            automatic={automatic}
          />

          {isCharts && (

            <FormControl fullWidth>

              <InputLabel id="panel-edit-chart-range">History range</InputLabel>

              <Select

                labelId="panel-edit-chart-range"

                label="History range"

                value={chartRange}

                onChange={(e) => setChartRange(e.target.value as HistoryRange)}

              >

                {CHART_RANGES.map((r) => (

                  <MenuItem key={r} value={r}>

                    {r}

                  </MenuItem>

                ))}

              </Select>

            </FormControl>

          )}

          {isCharts && (

            <PanelChartPresetFields

              presetId={chartPresetId}

              onPresetIdChange={setChartPresetId}

              minStr={chartMinStr}

              maxStr={chartMaxStr}

              onMinStrChange={setChartMinStr}

              onMaxStrChange={setChartMaxStr}

            />

          )}

          {showAreaScope && sectionRoomId && (

            <FormControlLabel

              control={

                <Checkbox

                  checked={inheritSection}

                  onChange={(e) => setInheritSection(e.target.checked)}

                />

              }

              label={`Use this section${sectionTitle ? ` (${sectionTitle})` : ""}`}

            />

          )}

          {showAreaScope && !inheritSection && (

            <FormControl fullWidth>

              <InputLabel id="panel-edit-area">{AREA.singular}</InputLabel>

              <Select

                labelId="panel-edit-area"

                label={AREA.singular}

                value={areaId}

                onChange={(e) => setAreaId(e.target.value)}

              >

                <MenuItem value="">All {AREA.plural.toLowerCase()}</MenuItem>

                {areas.map((a) => (

                  <MenuItem key={a.id} value={a.id}>

                    {a.name}

                  </MenuItem>

                ))}

              </Select>

            </FormControl>

          )}

          {showArrange && (
            <FormControl fullWidth size="small">
              <InputLabel id="panel-arrange">Arrange</InputLabel>
              <Select
                labelId="panel-arrange"
                label="Arrange"
                value={itemDirection}
                onChange={(e) => setItemDirection(e.target.value as PanelItemDirection)}
              >
                <MenuItem value="across">Across</MenuItem>
                <MenuItem value="down">Down</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Across places them in a row. Down stacks them. The panel will not shrink smaller than the items need.
              </Typography>
            </FormControl>
          )}
          {showArrange && (
            <FormControl fullWidth size="small">
              <InputLabel id="panel-item-style">Show as</InputLabel>
              <Select
                labelId="panel-item-style"
                label="Show as"
                value={itemStyle}
                onChange={(e) => setItemStyle(e.target.value as PanelItemStyle)}
              >
                <MenuItem value="auto">Automatic</MenuItem>
                <MenuItem value="tiles">Tiles</MenuItem>
                <MenuItem value="list">List</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Automatic shows a tile per item while they fit, and a list when the panel is too small.
              </Typography>
            </FormControl>
          )}

          {showItemDisplay && itemCount > 1 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">Items</Typography>
              <Stack spacing={1.5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="panel-item-names">Item names</InputLabel>
                  <Select
                    labelId="panel-item-names"
                    label="Item names"
                    value={itemDisplay.names}
                    onChange={(e) => setItemDisplay({ ...itemDisplay, names: e.target.value as ItemNamesMode })}
                  >
                    <MenuItem value="short">Short{nameExample ? ` — “${nameExample.short}”` : ""}</MenuItem>
                    <MenuItem value="full">Full{nameExample ? ` — “${nameExample.full}”` : ""}</MenuItem>
                    <MenuItem value="hide">Hidden</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel id="panel-item-icons">Item icons</InputLabel>
                  <Select
                    labelId="panel-item-icons"
                    label="Item icons"
                    value={itemDisplay.icons}
                    onChange={(e) => setItemDisplay({ ...itemDisplay, icons: e.target.value === "hide" ? "hide" : "show" })}
                  >
                    <MenuItem value="show">Shown</MenuItem>
                    <MenuItem value="hide">Hidden</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Each item shows its name and icon in its own tile. Short leaves out the part every
                item shares, which the panel title already shows. The pencil beside an item below
                gives it its own name or icon on this panel.
              </Typography>
            </Stack>
          )}

          {showSystemFilter && !isCamera && (
            <StatusLightEditorSection
              value={statusLight}
              onChange={setStatusLight}
              readings={(capabilityIds.length
                ? scopeCapabilities.filter((c) => capabilityIds.includes(c.id))
                : scopeCapabilities
              ).map((c) => ({ id: c.id, name: c.name, unit: c.unit, kind: c.kind }))}
            />
          )}

          {showSystemFilter && (

            <PanelContentFields

              panelKind={widget.type}

              capabilityIds={capabilityIds}

              onCapabilityIdsChange={setCapabilityIds}

              options={scopeCapabilities}

              overrides={itemDisplay.overrides}

              onOverridesChange={itemCount > 1 ? (overrides) => setItemDisplay({ ...itemDisplay, overrides }) : undefined}

            />

          )}

          {showCameraContent && (

            <PanelCameraContentFields

              cameraIds={cameraIds}

              onCameraIdsChange={setCameraIds}

              options={scopeCameras}

              overrides={itemDisplay.overrides}

              onOverridesChange={itemCount > 1 ? (overrides) => setItemDisplay({ ...itemDisplay, overrides }) : undefined}

            />

          )}

        </Stack>

        <Stack direction="row" spacing={1} sx={{ mt: "auto", pt: 2 }}>

          <Button variant="outlined" onClick={onClose} fullWidth>

            Cancel

          </Button>

          <Button variant="contained" onClick={handleSave} fullWidth>

            Apply

          </Button>

        </Stack>

      </Stack>

    </Drawer>

  );

}

