import { useEffect, useState } from "react";
import { Box, Button, FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { Segmented } from "../Segmented";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { SidePanel } from "../side-panel/SidePanel";
import { SidePanelButtons } from "../side-panel/SidePanelButtons";
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
  /** Panels per row: the choices for this dashboard, whether every panel here fits, and the current one. */
  perRow: { choices: { n: number; fits: boolean }[]; current: number | null };
};

type Props = {
  section: SectionSettingsValue | null;
  /** Puts the section back as it was when the menu opened, and closes it (also Escape). */
  onCancel: () => void;
  /** Keeps the changes and closes the menu. */
  onApply: () => void;
  onChange: (patch: { title?: string; icon?: string; showTitle?: boolean; colSpan?: SectionColSpan }) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  /** Makes every panel here the same width, `n` to a row. */
  onPanelsPerRow: (n: number) => void;
};

const WIDTHS: SectionColSpan[] = [12, 6, 4, 3];

/**
 * Section settings (side panel): name, icon, name bar, width, position and delete for one section.
 * The section being changed is outlined on the dashboard. Deleting asks first, here. Changes show
 * straight away; Apply keeps them, Cancel puts the section back.
 */
export function SectionSettingsPanel({ section, onCancel, onApply, onChange, onMove, onDelete, onPanelsPerRow }: Props) {
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => setAskDelete(false), [section?.id]);
  const s = section;
  return (
    <SidePanel
      open={Boolean(s)}
      onClose={onCancel}
      title="Section settings"
      subtitle={s?.title || "Untitled section"}
      footer={<SidePanelButtons onCancel={onCancel} onApply={onApply} />}
    >
      {s ? (
        <Stack spacing={3}>
          <TextField label="Name" size="small" fullWidth value={s.title} onChange={(e) => onChange({ title: e.target.value })} />
          <DashboardIconPicker dense value={s.icon ?? DEFAULT_SECTION_ICON} onChange={(icon) => onChange({ icon })} />
          <SettingBlock label="Section name on the dashboard">
            <FormControlLabel
              control={<Switch checked={s.showTitle !== false} onChange={(e) => onChange({ showTitle: e.target.checked })} />}
              label="Show the name above the panels"
            />
          </SettingBlock>
          <SettingBlock
            label="Section width"
          >
            <Segmented<SectionColSpan> label="Section width" value={s.colSpan} onChange={(v) => onChange({ colSpan: v })} options={WIDTHS.map((w) => ({ value: w, label: sectionColSpanLabel(w) }))} />
            {/* A small picture of the page width the section takes. */}
            <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "3px", mt: 1, maxWidth: 260 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <Box key={i} sx={{ height: 8, borderRadius: 0.25, bgcolor: i < s.colSpan ? "primary.main" : "action.selected" }} />
              ))}
            </Box>
          </SettingBlock>
          {s.panelCount > 0 ? (
            <SettingBlock label="Panels per row">
              <Segmented<number> label="Panels per row" value={s.perRow.current} onChange={onPanelsPerRow} options={s.perRow.choices.map((c) => ({ value: c.n, label: String(c.n), disabled: !c.fits }))} />
            </SettingBlock>
          ) : null}
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
                    Cancel
                  </Button>
                  <Button startIcon={<DeleteOutlineIcon />} variant="contained" color="error" onClick={onDelete}>
                    Delete
                  </Button>
                </ButtonRow>
              </>
            ) : (
              <>
                <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} disabled={s.isOnly} onClick={() => setAskDelete(true)}>
                  Delete this section
                </Button>
                {s.isOnly ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                    The only section can't be deleted.
                  </Typography>
                ) : null}
              </>
            )}
          </Box>
        </Stack>
      ) : null}
    </SidePanel>
  );
}
