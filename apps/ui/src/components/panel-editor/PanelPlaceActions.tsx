import { createContext, useContext, useState } from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { ButtonRow } from "../ButtonRow";

export type PanelPlace = {
  /** The panel's name, for the question before removing it. */
  name: string;
  kind: "panel" | "plugin";
  /** The section the panel is in now. */
  section: { id: string; title: string };
  /** The dashboard's other sections. */
  moveTargets: { id: string; title: string }[];
  onMove: (sectionId: string) => void;
  onRemove: () => void;
};

/** The panel being edited and where it sits; given by the dashboard around a panel's Edit menu. */
export const PanelPlaceContext = createContext<PanelPlace | null>(null);

/**
 * Bottom of a panel's Edit menu: move the panel to another section, or remove it (asked first, here).
 * Shown only when the dashboard gives the panel's place (not in previews elsewhere).
 */
export function PanelPlaceActions() {
  const place = useContext(PanelPlaceContext);
  const [target, setTarget] = useState("");
  const [askRemove, setAskRemove] = useState(false);
  if (!place) return null;
  return (
    <Stack spacing={2} sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Section
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ flex: 1, minWidth: 0 }} disabled={!place.moveTargets.length}>
            <InputLabel id="panel-move-target">Section</InputLabel>
            <Select labelId="panel-move-target" label="Section" value={target || place.section.id} onChange={(e) => setTarget(e.target.value)}>
              <MenuItem value={place.section.id}>{place.section.title || "Untitled section"} (now)</MenuItem>
              {place.moveTargets.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.title || "Untitled section"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" disabled={!target || target === place.section.id} onClick={() => place.onMove(target)}>
            Move
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {place.moveTargets.length
            ? "Pick another section and press Move to move this panel there."
            : "This dashboard has one section. Add another (Add section, at the top) to move panels between them."}
        </Typography>
      </Box>
      {askRemove ? (
        <Box>
          <Typography variant="body2">
            Remove “{place.name}” from the dashboard? Save the dashboard to keep this change.
          </Typography>
          <ButtonRow direction="row" sx={{ mt: 1 }}>
            <Button variant="outlined" onClick={() => setAskRemove(false)}>
              Keep it
            </Button>
            <Button variant="contained" color="error" onClick={place.onRemove}>
              Remove
            </Button>
          </ButtonRow>
        </Box>
      ) : (
        <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setAskRemove(true)} sx={{ alignSelf: "flex-start" }}>
          Remove this {place.kind}
        </Button>
      )}
    </Stack>
  );
}
