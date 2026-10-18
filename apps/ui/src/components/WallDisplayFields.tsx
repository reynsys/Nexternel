import { useEffect, useState } from "react";
import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { api, type DashboardSummary } from "../api";
import { normalizeWallPrefs, type WallPrefs } from "../lib/display-mode";

const ROTATE = [
  { value: 0, label: "Off" },
  { value: 30, label: "Every 30 seconds" },
  { value: 60, label: "Every minute" },
  { value: 120, label: "Every 2 minutes" },
  { value: 300, label: "Every 5 minutes" },
  { value: 600, label: "Every 10 minutes" },
];
const TEXT = [
  { value: 90, label: "Smaller" },
  { value: 100, label: "Normal" },
  { value: 110, label: "Larger" },
  { value: 125, label: "Largest" },
];

/**
 * How this account looks on a wall display (Display mode, <address>/display). Saved with the
 * account; a wall screen signed in with it applies changes within seconds.
 */
export function WallDisplayFields({ value, onChange }: { value: WallPrefs | undefined; onChange: (next: WallPrefs) => void }) {
  const wall = normalizeWallPrefs(value);
  const set = (patch: Partial<WallPrefs>) => onChange({ ...wall, ...patch });
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  useEffect(() => {
    void api
      .dashboards()
      .then((r) => setDashboards(r.dashboards))
      .catch(() => {});
  }, []);

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        For a wall screen or tablet signed in with this account, opened at <b>/display</b>. Changes show on the screen
        within seconds.
      </Typography>
      <FormControl size="small" fullWidth>
        <InputLabel id="wall-start">Start on</InputLabel>
        <Select labelId="wall-start" label="Start on" value={wall.start ?? ""} onChange={(e) => set({ start: e.target.value || null })}>
          <MenuItem value="">The home dashboard</MenuItem>
          {dashboards.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel id="wall-rotate">Move to the next dashboard</InputLabel>
        <Select labelId="wall-rotate" label="Move to the next dashboard" value={wall.rotate} onChange={(e) => set({ rotate: Number(e.target.value) })}>
          {ROTATE.map((r) => (
            <MenuItem key={r.value} value={r.value}>
              {r.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <div>
        <Typography variant="body2" sx={{ mb: 0.75 }}>
          Text size
        </Typography>
        <ToggleButtonGroup exclusive size="small" value={wall.textSize} onChange={(_, v: number | null) => v && set({ textSize: v })} aria-label="Wall text size">
          {TEXT.map((t) => (
            <ToggleButton key={t.value} value={t.value}>
              {t.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>
      <FormControlLabel control={<Switch checked={wall.tabs} onChange={(e) => set({ tabs: e.target.checked })} />} label="Show the room buttons" />
      <FormControlLabel
        control={<Switch checked={wall.light} onChange={(e) => set({ light: e.target.checked })} />}
        label={
          <Typography variant="body2">
            Light effects{" "}
            <Typography component="span" variant="caption" color="text.secondary">
              — no blur, glows or background effects; smooth on small computers such as a Raspberry Pi
            </Typography>
          </Typography>
        }
      />
    </Stack>
  );
}
