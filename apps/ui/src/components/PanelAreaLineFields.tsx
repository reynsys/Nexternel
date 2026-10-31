import { createContext, useContext } from "react";
import { FormControl, FormControlLabel, InputLabel, MenuItem, Radio, RadioGroup, Select, Stack, Typography } from "@mui/material";
import type { PanelAreaLine } from "@nexternel/domain";

/** The area line choice of the panel being edited (provided by the dashboard grid, saved with the panel). */
export type PanelAreaLineChoice = {
  value: PanelAreaLine;
  onChange: (line: PanelAreaLine) => void;
  /** What "From what it shows" gives now ("Living Room · Kids Bedroom"), or null (nothing). */
  automatic: string | null;
  areas: { id: string; name: string }[];
};

export const PanelAreaLineContext = createContext<PanelAreaLineChoice | null>(null);

/**
 * "Area shown under the title" in every panel's menu: from what it shows (automatic), an area
 * chosen here, or none. Shown wherever the panel editor's title block is.
 */
export function PanelAreaLineFields() {
  const ctx = useContext(PanelAreaLineContext);
  if (!ctx) return null;
  const { value, onChange, automatic, areas } = ctx;
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2">Area shown under the title</Typography>
      <RadioGroup
        value={value.mode}
        onChange={(e) => {
          const mode = e.target.value as PanelAreaLine["mode"];
          if (mode === "area") {
            const first = value.mode === "area" ? value : areas[0] ? { mode: "area" as const, areaId: areas[0].id, name: areas[0].name } : null;
            if (first) onChange(first);
          } else onChange({ mode });
        }}
      >
        <FormControlLabel
          value="auto"
          control={<Radio size="small" />}
          label={
            <span>
              From what it shows{" "}
              <Typography component="span" variant="body2" color="text.secondary">
                ({automatic ?? "nothing with an area"})
              </Typography>
            </span>
          }
        />
        <FormControlLabel value="area" control={<Radio size="small" />} label="Choose an area" disabled={areas.length === 0} />
        {value.mode === "area" ? (
          <FormControl size="small" sx={{ ml: 4, mb: 0.5, maxWidth: 280 }}>
            <InputLabel id="panel-area-line">Area</InputLabel>
            <Select
              labelId="panel-area-line"
              label="Area"
              value={value.areaId}
              onChange={(e) => {
                const a = areas.find((x) => x.id === e.target.value);
                if (a) onChange({ mode: "area", areaId: a.id, name: a.name });
              }}
            >
              {areas.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
        <FormControlLabel value="none" control={<Radio size="small" />} label="Don't show an area" />
      </RadioGroup>
    </Stack>
  );
}
