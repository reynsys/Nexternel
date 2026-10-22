import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import type { PanelMotion } from "../lib/motion";
import { useHasDecor } from "../skins/looks/LookDecor";

/**
 * Edit → Look: this panel's Animations — follow Settings → Appearance, or always on / off.
 * Only offered when something in the panel can move: the Look draws moving panel frames, or the
 * panel has switches (whose styles can animate). Otherwise the choice would change nothing.
 */
export function PanelMotionField({
  value,
  onChange,
  switches = false,
}: {
  value: PanelMotion;
  onChange: (v: PanelMotion) => void;
  /** The panel shows switches. */
  switches?: boolean;
}) {
  const lookMoves = useHasDecor("panel");
  if (!lookMoves && !switches) return null;
  return (
    <FormControl fullWidth size="small">
      <InputLabel id="panel-motion">Animations</InputLabel>
      <Select labelId="panel-motion" label="Animations" value={value} onChange={(e) => onChange(e.target.value as PanelMotion)}>
        <MenuItem value="follow">As in Settings → Appearance</MenuItem>
        <MenuItem value="on">On for this panel</MenuItem>
        <MenuItem value="off">Off for this panel</MenuItem>
      </Select>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
        Moving parts of this panel's look (frame lights, switch movements). Readings and switches keep working either way.
      </Typography>
    </FormControl>
  );
}
