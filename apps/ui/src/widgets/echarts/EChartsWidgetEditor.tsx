import { useEffect, useMemo, useState } from "react";
import { readPanelStatusLight, type PanelStatusLight } from "@nexternel/domain";
import { StatusLightEditorSection, statusLightConfig } from "../../components/status-light/StatusLightFields";
import {
  Box,
  Button,
  Divider,
  Drawer,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  InputAdornment,
} from "@mui/material";
import type { Capability, HistoryRange, WidgetInstance } from "../../api";
import { CapabilityPicker } from "../../components/CapabilityPicker";
import { PanelTitleFields } from "../../components/PanelTitleFields";
import { capabilityWidgetTitle } from "../../lib/capability-labels";
import { readTitleIcon, writeTitleIcon } from "../../lib/panel-title-icon";
import {
  persistBoundWidgetTitle,
} from "../../lib/widget-title";
import { VisualizationSlot } from "../../components/VisualizationSlot";
import { EChartsHost } from "./EChartsHost";
import { EChartsWidgetBody } from "./EChartsWidgetBody";
import { isPluginPanelType } from "@nexternel/domain";
import { GAUGE_WIDGET_TYPE } from "../gauge/manifest";
import { parseEchartsConfig } from "./config";
import type { EchartsPreset } from "./types";
import {
  getEchartsFamilyMeta,
  getEchartsPreset,
  groupEchartsPresetsByFamily,
  listEchartsPresets,
} from "./registry";
import { listEchartsFamilyMeta } from "./families";

type Props = {
  open: boolean;
  widget: WidgetInstance | null;
  capabilities: Capability[];
  onClose: () => void;
  onSave: (patch: Partial<WidgetInstance>) => void;
};

/** Edit scope — what kind of component is being edited (not a free mix of all presets). */
type EditScope = "gauge" | "history" | "liveDiagram" | "custom";

function editScopeForPreset(p: EchartsPreset): EditScope {
  if (p.family === "gauge") return "gauge";
  if (p.dataMode === "history" || p.category === "history") return "history";
  if (p.dataMode === "none" || p.family === "custom") return "custom";
  return "liveDiagram";
}

function presetsInScope(scope: EditScope): EchartsPreset[] {
  return listEchartsPresets().filter((p) => editScopeForPreset(p) === scope);
}

function familyOptionsInScope(scope: EditScope) {
  const present = new Set(presetsInScope(scope).map((p) => p.family));
  return listEchartsFamilyMeta().filter((f) => present.has(f.id));
}

function editorTitle(scope: EditScope): string {
  if (scope === "gauge") return "Edit gauge";
  if (scope === "history") return "Edit chart";
  if (scope === "custom") return "Edit chart";
  return "Edit sensor diagram";
}

function scopeAllLabel(scope: EditScope): string {
  if (scope === "history") return "All chart types";
  if (scope === "liveDiagram") return "All diagram types";
  return "All types";
}

function componentTypeLabel(scope: EditScope): string {
  if (scope === "history") return "Chart type";
  if (scope === "liveDiagram") return "Diagram type";
  return "Component type";
}

export function EChartsWidgetEditor({
  open,
  widget,
  capabilities,
  onClose,
  onSave,
}: Props) {
  const [presetId, setPresetId] = useState("gauge");
  const [title, setTitle] = useState("");
  const [titleIcon, setTitleIcon] = useState("auto");
  const [capabilityId, setCapabilityId] = useState("");
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [accent, setAccent] = useState("");
  const [range, setRange] = useState<HistoryRange>("24h");
  const [overrideText, setOverrideText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<EditScope>("gauge");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [statusLight, setStatusLight] = useState<PanelStatusLight>(readPanelStatusLight(null));

  useEffect(() => {
    if (!open || !widget) return;
    const cfg = parseEchartsConfig(widget.config);
    const current = getEchartsPreset(cfg.presetId);
    const scope = editScopeForPreset(current);
    const capId =
      typeof widget.bindings.capabilityId === "string" ? widget.bindings.capabilityId : "";
    const cap = capabilities.find((c) => c.id === capId);
    setPresetId(cfg.presetId);
    // Empty means automatic (the reading's name), shown in grey — like every other panel editor.
    setTitle(persistBoundWidgetTitle(widget.title ?? "", widget.type, cap) ?? "");
    setTitleIcon(readTitleIcon(widget.config));
    setStatusLight(readPanelStatusLight(widget.config));
    setCapabilityId(capId);
    setMinStr(cfg.min !== undefined ? String(cfg.min) : "");
    setMaxStr(cfg.max !== undefined ? String(cfg.max) : "");
    setAccent(cfg.accent ?? "");
    setRange(cfg.range ?? "24h");
    setOverrideText(cfg.optionOverride ? JSON.stringify(cfg.optionOverride, null, 2) : "");
    setJsonError(null);
    setEditScope(scope);
    setFamilyFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open/widget.id only
  }, [open, widget?.id]);

  const preset = getEchartsPreset(presetId);
  const scopedPresets = presetsInScope(editScope);
  const familyOptions = familyOptionsInScope(editScope);
  const showFamilySelect = familyOptions.length > 1;
  const filteredPresets = scopedPresets.filter(
    (p) =>
      familyFilter === "all" ||
      p.family === familyFilter ||
      p.id === presetId
  );
  const groupedPresets = groupEchartsPresetsByFamily(filteredPresets);
  const familyMeta = getEchartsFamilyMeta(preset.family);
  const typeLabel = componentTypeLabel(editScope);

  const previewWidget: WidgetInstance | null = useMemo(() => {
    if (!widget) return null;
    let optionOverride: Record<string, unknown> | undefined;
    if (overrideText.trim()) {
      try {
        const parsed = JSON.parse(overrideText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return {
            ...widget,
            title: title || widget.title,
            type: "echarts",
            bindings: capabilityId ? { capabilityId } : {},
            config: {
              ...widget.config,
              presetId,
              range,
              accent: accent || undefined,
              min: minStr === "" ? undefined : Number(minStr),
              max: maxStr === "" ? undefined : Number(maxStr),
            },
          };
        }
        optionOverride = parsed as Record<string, unknown>;
      } catch {
        /* keep previous preview without override */
      }
    }
    const min = minStr === "" ? undefined : Number(minStr);
    const max = maxStr === "" ? undefined : Number(maxStr);
    return {
      ...widget,
      title: title || widget.title,
      type: "echarts",
      bindings: capabilityId ? { capabilityId } : {},
      config: {
        ...widget.config,
        presetId,
        range,
        accent: accent || undefined,
        min: min !== undefined && !Number.isNaN(min) ? min : undefined,
        max: max !== undefined && !Number.isNaN(max) ? max : undefined,
        optionOverride,
      },
    };
  }, [
    widget,
    title,
    capabilityId,
    presetId,
    range,
    accent,
    minStr,
    maxStr,
    overrideText,
  ]);

  const cap = capabilities.find((c) => c.id === capabilityId);
  const sensorCapabilities = useMemo(
    () => capabilities.filter((c) => c.kind !== "switch"),
    [capabilities]
  );

  function handleApply() {
    if (!widget) return;
    let optionOverride: Record<string, unknown> | undefined;
    if (overrideText.trim()) {
      try {
        const parsed = JSON.parse(overrideText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setJsonError("optionOverride must be a JSON object");
          return;
        }
        optionOverride = parsed as Record<string, unknown>;
        setJsonError(null);
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : "Invalid JSON");
        return;
      }
    } else {
      setJsonError(null);
    }
    const min = minStr === "" ? undefined : Number(minStr);
    const max = maxStr === "" ? undefined : Number(maxStr);
    if (minStr !== "" && Number.isNaN(min)) {
      setJsonError("Min must be a number");
      return;
    }
    if (maxStr !== "" && Number.isNaN(max)) {
      setJsonError("Max must be a number");
      return;
    }
    const saveType =
      widget.type === GAUGE_WIDGET_TYPE || isPluginPanelType(widget.type)
        ? widget.type
        : "echarts";
    onSave({
      title:
        persistBoundWidgetTitle(title, widget.type, cap) ??
        (title.trim() || undefined),
      type: saveType,
      bindings: capabilityId ? { capabilityId } : {},
      config: writeTitleIcon(
        {
          presetId,
          range: preset.dataMode === "history" ? range : undefined,
          accent: accent.trim() || undefined,
          min,
          max,
          optionOverride,
          ...statusLightConfig(statusLight),
        },
        titleIcon
      ),
    });
    onClose();
  }

  const accentColour = /^#[0-9a-fA-F]{6}$/.test(accent.trim()) ? accent.trim() : "#1A73E8";

  const preview = (
    <Stack spacing={1} sx={{ minWidth: 0 }}>
      <Typography variant="subtitle2">Preview</Typography>
      <Box
        sx={{
          height: 240,
          minHeight: 240,
          display: "flex",
          flexDirection: "column",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          p: 1,
          flexShrink: 0,
        }}
      >
        {previewWidget ? (
          <VisualizationSlot sx={{ flex: 1, minHeight: 220, height: "100%" }}>
            <EChartsHost>
              <EChartsWidgetBody
                widget={previewWidget}
                cap={cap}
                dataLabel={cap?.name ?? (title || preset.label)}
                tileTitle={title.trim() || previewWidget.title?.trim() || null}
              />
            </EChartsHost>
          </VisualizationSlot>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ m: "auto" }}>
            Choose a capability to preview this panel.
          </Typography>
        )}
      </Box>
    </Stack>
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: editScope === "gauge" ? 440 : 420 }, p: 2 } }}
    >
      {widget ? (
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Typography variant="h6">{editorTitle(editScope)}</Typography>
        {editScope !== "gauge" && (
          <Typography variant="caption" color="text.secondary">
            {editScope === "history"
              ? "Choose how values are plotted over time."
              : editScope === "liveDiagram"
                ? "Choose a live diagram style for the current value."
                : "Advanced chart configuration."}
          </Typography>
        )}

        <PanelTitleFields
          title={title}
          onTitleChange={setTitle}
          icon={titleIcon}
          onIconChange={setTitleIcon}
          automatic={{
            title: cap ? capabilityWidgetTitle(cap) : null,
            icon: { iconId: cap?.icon ?? "auto", kind: cap?.kind ?? null },
          }}
        />

        {showFamilySelect && (
          <FormControl fullWidth size="small">
            <InputLabel id="echarts-family">{typeLabel}</InputLabel>
            <Select
              labelId="echarts-family"
              label={typeLabel}
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
            >
              <MenuItem value="all">{scopeAllLabel(editScope)}</MenuItem>
              {familyOptions.map((f) => (
                <MenuItem key={f.id} value={f.id}>
                  <Stack spacing={0} sx={{ py: 0.25 }}>
                    <Typography variant="body2">{f.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {f.hint}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {showFamilySelect && familyFilter !== "all" && (
          <Typography variant="caption" color="text.secondary">
            {getEchartsFamilyMeta(familyFilter).hint}
          </Typography>
        )}

        <FormControl fullWidth size="small">
          <InputLabel id="echarts-preset">
            {editScope === "gauge" ? "Gauge style" : "Preset"}
          </InputLabel>
          <Select
            labelId="echarts-preset"
            label={editScope === "gauge" ? "Gauge style" : "Preset"}
            value={presetId}
            onChange={(e) => {
              const nextId = e.target.value;
              setPresetId(nextId);
              // Keep family filter on "all" so the full preset list stays visible
              if (familyFilter !== "all") {
                setFamilyFilter(getEchartsPreset(nextId).family);
              }
            }}
          >
            {groupedPresets.flatMap(({ family, presets: list }) => [
              ...(showFamilySelect && familyFilter === "all"
                ? [<ListSubheader key={`h-${family.id}`}>{family.label}</ListSubheader>]
                : []),
              ...list.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.label}
                </MenuItem>
              )),
            ])}
          </Select>
        </FormControl>
        {editScope !== "gauge" && (
          <Typography variant="caption" color="text.secondary">
            {familyMeta.label}: {preset.description}
          </Typography>
        )}

        {preset.needsCapability && (
          <CapabilityPicker
            capabilities={sensorCapabilities}
            value={capabilityId}
            onChange={setCapabilityId}
            label={preset.dataMode === "history" ? "What to chart" : editScope === "gauge" ? "What to show" : "What to use"}
            hint={editScope === "gauge" ? "Search, then pick from the list." : undefined}
            helperText={editScope === "gauge" ? "" : undefined}
          />
        )}

        {preset.dataMode === "history" && (
          <FormControl fullWidth size="small">
            <InputLabel id="echarts-range">History range</InputLabel>
            <Select
              labelId="echarts-range"
              label="History range"
              value={range}
              onChange={(e) => setRange(e.target.value as HistoryRange)}
            >
              <MenuItem value="1h">Last 1 hour</MenuItem>
              <MenuItem value="6h">Last 6 hours</MenuItem>
              <MenuItem value="24h">Last 24 hours</MenuItem>
              <MenuItem value="7d">Last 7 days</MenuItem>
            </Select>
          </FormControl>
        )}

        {editScope === "gauge" ? preview : null}

        {cap ? (
          <StatusLightEditorSection
            value={statusLight}
            onChange={setStatusLight}
            readings={[{ id: cap.id, name: cap.name, unit: cap.unit, kind: cap.kind }]}
          />
        ) : null}

        <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Min"
                size="small"
                fullWidth
                value={minStr}
                onChange={(e) => setMinStr(e.target.value)}
                placeholder="auto"
              />
              <TextField
                label="Max"
                size="small"
                fullWidth
                value={maxStr}
                onChange={(e) => setMaxStr(e.target.value)}
                placeholder="auto"
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {editScope === "gauge"
                ? "Lowest and highest marks on the dial. Leave blank to use the sensor’s usual range, such as temperature 0–60."
                : "Min / Max pin the value axis on the dashboard (e.g. 0–100). Leave blank to use sensor defaults (temperature 0–60, humidity 0–100, …)."}
            </Typography>

            <TextField
              label="Accent colour"
              size="small"
              fullWidth
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#1A73E8"
              helperText="A colour such as #1A73E8. Leave blank to use the colour from Settings → Appearance."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      component="input"
                      type="color"
                      aria-label="Pick accent colour"
                      value={accentColour}
                      onChange={(e) => setAccent((e.target as HTMLInputElement).value)}
                      sx={{ width: 28, height: 28, p: 0, border: 0, bgcolor: "transparent", cursor: "pointer" }}
                    />
                  </InputAdornment>
                ),
              }}
            />

            {editScope !== "gauge" && (
              <>
                <Divider />
                <Typography variant="subtitle2">Advanced — optionOverride (JSON)</Typography>
                <TextField
                  multiline
                  minRows={6}
                  maxRows={14}
                  fullWidth
                  size="small"
                  value={overrideText}
                  onChange={(e) => {
                    setOverrideText(e.target.value);
                    setJsonError(null);
                  }}
                  placeholder='{ "series": [{ "axisLine": { "lineStyle": { "width": 20 } } }] }'
                  sx={{ fontFamily: "ui-monospace, monospace", "& textarea": { fontFamily: "inherit" } }}
                />
                <Button size="small" onClick={() => setOverrideText("")}>
                  Reset override
                </Button>
                {jsonError && <Alert severity="error">{jsonError}</Alert>}
                {preview}
              </>
            )}
        </Stack>

        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleApply}>
            Apply
          </Button>
        </Stack>
      </Stack>
      ) : null}
    </Drawer>
  );
}
