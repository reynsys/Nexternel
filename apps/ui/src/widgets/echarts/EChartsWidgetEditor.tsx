import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PanelEditorShell } from "../../components/panel-editor/PanelEditorShell";
import { readingCanHaveLight } from "../../lib/status-light-show";
import { readPanelStatusLight, type PanelStatusLight } from "@nexternel/domain";
import { StatusLightEditorSection, statusLightConfig } from "../../components/status-light/StatusLightFields";
import {
  Box,
  Button,
  Divider,
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
  /** Draws the panel as it would look with these unsaved changes (the Edit menu's preview). */
  renderPreview?: (patch: Partial<WidgetInstance>) => ReactNode;
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

function kindName(scope: EditScope): string {
  if (scope === "gauge") return "Gauge";
  if (scope === "history" || scope === "custom") return "Chart";
  return "Sensor diagram";
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
  renderPreview,
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


  const cap = capabilities.find((c) => c.id === capabilityId);
  const sensorCapabilities = useMemo(
    () => capabilities.filter((c) => c.kind !== "switch"),
    [capabilities]
  );

  /** The change Apply would save, or what is wrong with the settings. */
  function patchFrom(): { patch: Partial<WidgetInstance>; error?: undefined } | { error: string } {
    if (!widget) return { error: "No panel" };
    let optionOverride: Record<string, unknown> | undefined;
    if (overrideText.trim()) {
      try {
        const parsed = JSON.parse(overrideText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return { error: "optionOverride must be a JSON object" };
        }
        optionOverride = parsed as Record<string, unknown>;
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Invalid JSON" };
      }
    }
    const min = minStr === "" ? undefined : Number(minStr);
    const max = maxStr === "" ? undefined : Number(maxStr);
    if (minStr !== "" && Number.isNaN(min)) return { error: "Min must be a number" };
    if (maxStr !== "" && Number.isNaN(max)) return { error: "Max must be a number" };
    const saveType =
      widget.type === GAUGE_WIDGET_TYPE || isPluginPanelType(widget.type)
        ? widget.type
        : "echarts";
    return {
      patch: {
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
      },
    };
  }

  function handleApply() {
    const result = patchFrom();
    if (result.error !== undefined) {
      setJsonError(result.error);
      return;
    }
    setJsonError(null);
    onSave(result.patch);
    onClose();
  }

  const accentColour = /^#[0-9a-fA-F]{6}$/.test(accent.trim()) ? accent.trim() : "#1A73E8";

  const previewResult = open && renderPreview ? patchFrom() : null;
  const kindLabel = kindName(editScope);
  const shownTitle = title.trim() || (cap ? capabilityWidgetTitle(cap) : null) || kindLabel;

  if (!widget) return null;
  return (
    <PanelEditorShell
      open={open}
      title={`Edit ${shownTitle}`}
      kindLabel={kindLabel}
      preview={previewResult && previewResult.error === undefined ? renderPreview?.(previewResult.patch) : null}
      onCancel={onClose}
      onApply={handleApply}
      footerNote={jsonError ? <Alert severity="error">{jsonError}</Alert> : null}
      tabs={[
        {
          id: "content",
          label: "Content",
          content: (
            <>
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

            </>
          ),
        },
        {
          id: "look",
          label: "Look",
          content: (
            <>
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
              </>
            )}
            </>
          ),
        },
        {
          id: "light",
          label: "Status light",
          content:
            cap && readingCanHaveLight(cap.kind) ? (
              <>
          <StatusLightEditorSection
              showHeading={false}
            value={statusLight}
            onChange={setStatusLight}
            readings={[{ id: cap.id, name: cap.name, unit: cap.unit, kind: cap.kind }]}
          />
                      </>
            ) : null,
        },
      ]}
    />
  );
}
