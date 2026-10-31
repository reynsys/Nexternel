import type { ReactNode } from "react";
import { Box, FormControlLabel, Stack, Switch, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { SidePanel } from "../side-panel/SidePanel";
import { DashboardIconPicker } from "../DashboardIconPicker";
import { ManageDashboardsPanel } from "../ManageDashboardsPanel";

export type DashboardSettingsPage = "this" | "all";

type Props = {
  open: boolean;
  page: DashboardSettingsPage;
  onPage: (page: DashboardSettingsPage) => void;
  onClose: () => void;
  dashboardId?: string;
  name: string;
  onName: (v: string) => void;
  icon: string;
  onIcon: (v: string) => void;
  showName: boolean;
  onShowName: (v: boolean) => void;
  /** Columns the panels are arranged on: 10 = 5 across, 8 = 4 across. */
  gridCols: 10 | 8 | 12;
  onGridCols: (v: 10 | 8) => void;
  sectionShortcuts: boolean;
  onSectionShortcuts: (v: boolean) => void;
  onDashboardsChanged: () => void;
  onCurrentMeta: (meta: { name: string; tabIcon: string; showTabLabel: boolean }) => void;
};

/** A setting with its name and, under it, what it does. */
export function SettingBlock({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {label}
      </Typography>
      {children}
      {help ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
          {help}
        </Typography>
      ) : null}
    </Box>
  );
}

/**
 * Dashboard settings (side panel): this dashboard's name, icon and layout choices, and every
 * dashboard on the system. Changes show on the dashboard straight away; Save keeps them.
 */
export function DashboardSettingsPanel(p: Props) {
  return (
    <SidePanel
      open={p.open}
      onClose={p.onClose}
      title="Dashboard settings"
      top={
        <Tabs value={p.page} onChange={(_e, v: DashboardSettingsPage) => p.onPage(v)} variant="fullWidth">
          <Tab value="this" label="This dashboard" />
          <Tab value="all" label="All dashboards" />
        </Tabs>
      }
    >
      {p.page === "this" ? (
        <Stack spacing={3}>
          <TextField label="Name" size="small" fullWidth value={p.name} onChange={(e) => p.onName(e.target.value)} />
          <DashboardIconPicker dense value={p.icon} onChange={p.onIcon} />
          <SettingBlock label="In the Dashboard Menu">
            <FormControlLabel
              control={<Switch checked={p.showName} onChange={(e) => p.onShowName(e.target.checked)} />}
              label="Show the name next to the icon"
            />
          </SettingBlock>
          <SettingBlock
            label="Panels across"
            help="How many standard panels fit side by side in a full-width section. 4 makes every panel bigger."
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              aria-label="Panels across"
              value={p.gridCols === 8 ? 8 : 10}
              onChange={(_e, v: 10 | 8 | null) => v && p.onGridCols(v)}
            >
              <ToggleButton value={10}>5</ToggleButton>
              <ToggleButton value={8}>4</ToggleButton>
            </ToggleButtonGroup>
          </SettingBlock>
          <SettingBlock label="Section shortcuts" help="A row of buttons above the sections; one tap jumps to a section. Handy on long dashboards.">
            <FormControlLabel
              control={<Switch checked={p.sectionShortcuts} onChange={(e) => p.onSectionShortcuts(e.target.checked)} />}
              label="Show section shortcuts"
            />
          </SettingBlock>
          <Typography variant="caption" color="text.secondary">
            Changes show on the dashboard straight away; Save keeps them.
          </Typography>
        </Stack>
      ) : (
        <ManageDashboardsPanel
          compact
          currentDashboardId={p.dashboardId}
          onDashboardsChanged={p.onDashboardsChanged}
          onCurrentTabMeta={p.onCurrentMeta}
        />
      )}
    </SidePanel>
  );
}
