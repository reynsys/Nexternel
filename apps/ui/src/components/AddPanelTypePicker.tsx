import { useMemo } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import SpeedIcon from "@mui/icons-material/Speed";
import SensorsIcon from "@mui/icons-material/Sensors";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WbCloudyOutlinedIcon from "@mui/icons-material/WbCloudyOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import MemoryIcon from "@mui/icons-material/Memory";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import DevicesOtherOutlinedIcon from "@mui/icons-material/DevicesOtherOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import { groupAddPanelDiscovery, type AddPanelDiscoveryItem } from "../lib/add-panel-discovery";
import { ICON_SIZE } from "../lib/appearance/type";
import { choiceSx } from "../skins/surfaceStyles";

type Props = {
  catalog: AddPanelDiscoveryItem[];
  value: string;
  onChange: (typeId: string) => void;
};

/** A picture for each kind of panel (an extension's panels share the extension picture). */
const TYPE_ICON: Record<string, SvgIconComponent> = {
  "panel.gauge": SpeedIcon,
  "panel.status": SensorsIcon,
  "panel.charts": ShowChartIcon,
  "panel.controls": ToggleOnOutlinedIcon,
  "panel.camera": VideocamOutlinedIcon,
  "panel.clock": ScheduleIcon,
  "panel.weather": WbCloudyOutlinedIcon,
  "panel.calendar": CalendarMonthOutlinedIcon,
  "panel.system": MemoryIcon,
  "panel.rooms": MeetingRoomOutlinedIcon,
  "panel.devices": DevicesOtherOutlinedIcon,
};

/**
 * Add panel, step 1 — what kind of panel: large picture tiles in plain groups (Readings, Switches
 * and cameras, Information, From your extensions). The chosen one is filled; its short line says
 * what it shows.
 */
export function AddPanelTypePicker({ catalog, value, onChange }: Props) {
  const groups = useMemo(() => groupAddPanelDiscovery(catalog), [catalog]);
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {groups.map((group) => (
        <Box key={group.section} role="group" aria-label={group.label}>
          <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 0.75, lineHeight: 1.4 }}>
            {group.label}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: "var(--nx-control-gap)" }}>
            {group.items.map((item) => {
              const Icon = TYPE_ICON[item.id] ?? ExtensionOutlinedIcon;
              const chosen = value === item.id;
              return (
                <ButtonBase
                  key={item.id}
                  aria-pressed={chosen}
                  title={item.description}
                  onClick={() => onChange(item.id)}
                  sx={[
                    {
                      minHeight: 92,
                      p: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.75,
                      color: chosen ? "primary.main" : "text.primary",
                      textAlign: "center",
                      "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                    },
                    // The Look's choice: its border, fill and shadow, and its chosen state.
                    choiceSx(chosen, { hover: true }),
                  ]}
                >
                  <Icon sx={{ fontSize: ICON_SIZE.feature }} />
                  <Typography variant="body2" fontWeight={chosen ? "fontWeightBold" : undefined}>
                    {item.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Box>
      ))}
      {value ? (
        <Typography variant="body2" color="text.secondary">
          {catalog.find((i) => i.id === value)?.description}
        </Typography>
      ) : null}
    </Box>
  );
}
