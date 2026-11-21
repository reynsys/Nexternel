import { createContext, useContext } from "react";
import { FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import { Segmented } from "./Segmented";
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
    <Stack spacing={1}>
      <Typography variant="subtitle2">Area shown under the title</Typography>
      <Segmented<PanelAreaLine["mode"]>
        label="Area shown under the title"
        value={value.mode}
        onChange={(mode) => {
          if (mode === "area") {
            const first = value.mode === "area" ? value : areas[0] ? { mode: "area" as const, areaId: areas[0].id, name: areas[0].name } : null;
            if (first) onChange(first);
          } else onChange({ mode });
        }}
        options={[
          { value: "auto", label: "From what it shows" },
          { value: "area", label: "Choose an area", disabled: areas.length === 0 },
          { value: "none", label: "Don't show an area" },
        ]}
      />
      {value.mode === "auto" ? (
        <Typography variant="body2" color="text.secondary">
          Shows: {automatic ?? "nothing with an area"}
        </Typography>
      ) : null}
      {value.mode === "area" ? (
        <FormControl size="small" sx={{ mt: 1, maxWidth: 280 }}>
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
    </Stack>
  );
}
