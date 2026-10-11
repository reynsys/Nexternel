import { useMemo, useState } from "react";
import {
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  getEchartsFamilyMeta,
  getEchartsPreset,
  groupEchartsPresetsByFamily,
  listEchartsFamilyOptionsForCategory,
  listEchartsPresetsByCategory,
} from "../widgets/echarts/registry";

type Props = {
  presetId: string;
  onPresetIdChange: (id: string) => void;
  minStr: string;
  maxStr: string;
  onMinStrChange: (value: string) => void;
  onMaxStrChange: (value: string) => void;
};

export function PanelChartPresetFields({
  presetId,
  onPresetIdChange,
  minStr,
  maxStr,
  onMinStrChange,
  onMaxStrChange,
}: Props) {
  const [familyFilter, setFamilyFilter] = useState("all");
  const historyPresets = useMemo(() => listEchartsPresetsByCategory("history"), []);
  const familyOptions = useMemo(
    () => listEchartsFamilyOptionsForCategory("history"),
    []
  );
  const groupedPresets = useMemo(() => {
    const filtered =
      familyFilter === "all"
        ? historyPresets
        : historyPresets.filter((p) => p.family === familyFilter);
    return groupEchartsPresetsByFamily(filtered);
  }, [historyPresets, familyFilter]);

  const preset = getEchartsPreset(presetId);
  const familyMeta = getEchartsFamilyMeta(preset.family);
  const showFamilySelect = familyOptions.length > 1;

  return (
    <Stack spacing={1.5}>
      {showFamilySelect && (
        <FormControl fullWidth size="small">
          <InputLabel id="panel-chart-family">Chart type</InputLabel>
          <Select
            labelId="panel-chart-family"
            label="Chart type"
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
          >
            <MenuItem value="all">All chart types</MenuItem>
            {familyOptions.map((f) => (
              <MenuItem key={f.id} value={f.id}>
                {f.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <FormControl fullWidth size="small">
        <InputLabel id="panel-chart-preset">Style</InputLabel>
        <Select
          labelId="panel-chart-preset"
          label="Style"
          value={presetId}
          onChange={(e) => onPresetIdChange(e.target.value)}
        >
          {groupedPresets.flatMap(({ family, presets }) => [
            ...(showFamilySelect && familyFilter === "all"
              ? [<ListSubheader key={`h-${family.id}`}>{family.label}</ListSubheader>]
              : []),
            ...presets.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            )),
          ])}
        </Select>
      </FormControl>

      <Typography variant="caption" color="text.secondary">
        {familyMeta.label}: {preset.description}
      </Typography>

      <Stack direction="row" spacing={1}>
        <TextField
          label="Min"
          size="small"
          fullWidth
          value={minStr}
          onChange={(e) => onMinStrChange(e.target.value)}
          placeholder="auto"
        />
        <TextField
          label="Max"
          size="small"
          fullWidth
          value={maxStr}
          onChange={(e) => onMaxStrChange(e.target.value)}
          placeholder="auto"
        />
      </Stack>
    </Stack>
  );
}
