import { useEffect, useState } from "react";
import { Box, Button, FormControlLabel, Stack, Switch, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { SidePanel } from "../side-panel/SidePanel";
import { DashboardIconPicker } from "../DashboardIconPicker";
import { ButtonRow } from "../ButtonRow";
import { SettingBlock } from "./DashboardSettingsPanel";
import { DEFAULT_SECTION_ICON, sectionColSpanLabel, type SectionColSpan } from "../../lib/dashboard-document";

export type SectionSettingsValue = {
  id: string;
  title: string;
  icon?: string;
  showTitle?: boolean;
  colSpan: SectionColSpan;
  panelCount: number;
  isFirst: boolean;
  isLast: boolean;
  isOnly: boolean;
};

type Props = {
  section: SectionSettingsValue | null;
  onClose: () => void;
  onChange: (patch: { title?: string; icon?: string; showTitle?: boolean; colSpan?: SectionColSpan }) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
};

const WIDTHS: SectionColSpan[] = [12, 6, 4, 3];

/**
 * Section settings (side panel): name, icon, name bar, width, position and delete for one section.
 * The section being changed is outlined on the dashboard. Deleting asks first, here.
 */
export function SectionSettingsPanel({ section, onClose, onChange, onMove, onDelete }: Props) {
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => setAskDelete(false), [section?.id]);
  const s = section;
  return (
    <SidePanel open={Boolean(s)} onClose={onClose} title="Section settings" subtitle={s?.title || "Untitled section"}>
      {s ? (
        <Stack spacing={3}>
          <TextField label="Name" size="small" fullWidth value={s.title} onChange={(e) => onChange({ title: e.target.value })} />
          <DashboardIconPicker dense value={s.icon ?? DEFAULT_SECTION_ICON} onChange={(icon) => onChange({ icon })} />
          <SettingBlock label="Section name on the dashboard" help="Off: the panels show inside the section's frame without its name bar.">
            <FormControlLabel
              control={<Switch checked={s.showTitle !== false} onChange={(e) => onChange({ showTitle: e.target.checked })} />}
              label={s.showTitle !== false ? "Shown above the panels" : "Hidden"}
            />
          </SettingBlock>
          <SettingBlock
            label="Section width"
            help="How much of the page width this section takes. Narrower sections sit side by side; on phones every section is full width."
          >
            <ToggleButtonGroup exclusive size="small" aria-label="Section width" value={s.colSpan} onChange={(_e, v: SectionColSpan | null) => v && onChange({ colSpan: v })}>
              {WIDTHS.map((w) => (
                <ToggleButton key={w} value={w}>
                  {sectionColSpanLabel(w)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {/* A small picture of the page width the section takes. */}
            <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "3px", mt: 1, maxWidth: 260 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <Box key={i} sx={{ height: 8, borderRadius: 0.25, bgcolor: i < s.colSpan ? "primary.main" : "action.selected" }} />
              ))}
            </Box>
          </SettingBlock>
          <SettingBlock label="Position on the page">
            <ButtonRow direction="row">
              <Button variant="outlined" startIcon={<ArrowUpwardIcon />} disabled={s.isFirst} onClick={() => onMove(-1)}>
                Move up
              </Button>
              <Button variant="outlined" startIcon={<ArrowDownwardIcon />} disabled={s.isLast} onClick={() => onMove(1)}>
                Move down
              </Button>
            </ButtonRow>
          </SettingBlock>
          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
            {askDelete ? (
              <>
                <Typography variant="body2">
                  Delete “{s.title || "this section"}” and its {s.panelCount} panel{s.panelCount === 1 ? "" : "s"}? Save the dashboard to keep this change.
                </Typography>
                <ButtonRow direction="row" sx={{ mt: 1 }}>
                  <Button variant="outlined" onClick={() => setAskDelete(false)}>
                    Keep it
                  </Button>
                  <Button variant="contained" color="error" onClick={onDelete}>
                    Delete
                  </Button>
                </ButtonRow>
              </>
            ) : (
              <>
                <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} disabled={s.isOnly} onClick={() => setAskDelete(true)}>
                  Delete this section
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  {s.isOnly
                    ? "A dashboard needs at least one section, so the only section can't be deleted."
                    : `Deletes the section and its ${s.panelCount} panel${s.panelCount === 1 ? "" : "s"}.`}
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      ) : null}
    </SidePanel>
  );
}
