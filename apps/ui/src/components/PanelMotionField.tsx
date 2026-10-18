import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import type { PanelMotion } from "../lib/motion";

/** Edit → Look: this panel's Animations — follow Settings → Appearance, or always on / off. */
export function PanelMotionField({ value, onChange }: { value: PanelMotion; onChange: (v: PanelMotion) => void }) {
  return (
    <FormControl fullWidth size="small">
      <InputLabel id="panel-motion">Animations</InputLabel>
      <Select labelId="panel-motion" label="Animations" value={value} onChange={(e) => onChange(e.target.value as PanelMotion)}>
        <MenuItem value="follow">As in Settings → Appearance</MenuItem>
        <MenuItem value="on">On for this panel</MenuItem>
        <MenuItem value="off">Off for this panel</MenuItem>
      </Select>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
        Moving decorations of the Look (frames, rings, gears). Readings and switches keep working either way.
      </Typography>
    </FormControl>
  );
}
