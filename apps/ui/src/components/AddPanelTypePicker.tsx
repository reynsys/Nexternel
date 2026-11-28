import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
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
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import { pluginPanelBlock } from "../plugins/loadContributions";
import { groupAddPanelDiscovery, type AddPanelDiscoveryItem } from "../lib/add-panel-discovery";
import { ICON_SIZE } from "../lib/appearance/type";
import { ChoiceTile } from "../skins/ThemePresetTile";

type Props = {
  catalog: AddPanelDiscoveryItem[];
  value: string;
  onChange: (typeId: string) => void;
};

/** An extension panel's picture comes from what it draws. */
const BLOCK_ICON: Record<string, SvgIconComponent> = {
  conversation: ForumOutlinedIcon,
  text: ArticleOutlinedIcon,
  map: MapOutlinedIcon,
};

/** A picture for each kind of panel. */
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
              const Icon = TYPE_ICON[item.id] ?? BLOCK_ICON[pluginPanelBlock(item.id) ?? ""] ?? ExtensionOutlinedIcon;
              const chosen = value === item.id;
              return (
                <ChoiceTile key={item.id} selected={chosen} onClick={() => onChange(item.id)} title={item.label}>
                  <Icon color="primary" sx={{ fontSize: ICON_SIZE.feature, mb: 0.25 }} />
                </ChoiceTile>
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
