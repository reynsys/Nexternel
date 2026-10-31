import { useEffect, useState, type ReactNode } from "react";
import { api, type DeviceConnection } from "../../../api";
import { Box, ListItemButton, Typography, useTheme } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import { ICON_SIZE } from "../../../lib/appearance/type";
import { insetSx } from "../../../skins/surfaceStyles";
import type { StatusTone } from "./device-summary";
import { devicesActionGroupSx, devicesNavItemSx } from "./devices-panel-styles";

/** The kinds of thing on the Devices page, each with its picture and its name in words. */
export type DeviceKind = "board" | "switch" | "camera" | "service";
export const KIND_ICON: Record<DeviceKind, SvgIconComponent> = {
  board: MemoryRoundedIcon,
  switch: ToggleOnOutlinedIcon,
  camera: VideocamOutlinedIcon,
  service: CloudOutlinedIcon,
};
export const KIND_WORD: Record<DeviceKind, string> = {
  board: "ESPHome board",
  switch: "Shelly switch",
  camera: "Camera",
  service: "Online service",
};

const TONE_COLOUR: Record<StatusTone, string> = {
  ok: "success.main",
  warn: "warning.main",
  bad: "error.main",
  off: "text.disabled",
};

/** A device's picture in a small tile (the list, the device's header). */
export function KindTile({ kind, size = 40 }: { kind: DeviceKind; size?: number }) {
  const Icon = KIND_ICON[kind];
  return (
    <Box
      aria-hidden
      sx={[
        { width: size, height: size, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main" },
        insetSx(),
      ]}
    >
      <Icon sx={{ fontSize: size >= 48 ? ICON_SIZE.picker : ICON_SIZE.title + 4 }} />
    </Box>
  );
}

/** A status in one word with its coloured dot: Online, Offline, Update ready… */
export function StatusWord({ word, tone, emphasis = false }: { word: string; tone: StatusTone; emphasis?: boolean }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0, color: TONE_COLOUR[tone] }}>
      <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: TONE_COLOUR[tone], flex: "none" }} />
      <Typography variant={emphasis ? "body2" : "caption"} fontWeight={emphasis ? "fontWeightBold" : undefined} color="inherit" noWrap>
        {word}
      </Typography>
    </Box>
  );
}

/** One thing in the Devices list — the same for a board, a switch, a camera or a service. */
export function DeviceRow({
  kind,
  name,
  summary,
  status,
  selected,
  onClick,
  extra,
}: {
  kind: DeviceKind;
  name: string;
  summary: string;
  status: { word: string; tone: StatusTone };
  selected: boolean;
  onClick: () => void;
  extra?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <ListItemButton selected={selected} onClick={onClick} sx={[devicesNavItemSx(theme, selected) as object, { gap: 1.5, alignItems: "center" }]}>
      <KindTile kind={kind} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div" noWrap>
          {summary}
        </Typography>
        {extra}
      </Box>
      <StatusWord word={status.word} tone={status.tone} />
    </ListItemButton>
  );
}

/** A box on a device's page (Overview, Troubleshooting): its name in small capitals, then its content. */
export function InfoCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const theme = useTheme();
  return (
    <Box sx={{ ...devicesActionGroupSx(theme), display: "flex", flexDirection: "column", gap: 1, minWidth: 0, height: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1, lineHeight: 1.6 }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}

/** A device's connection summary (last 24 hours), fetched again when `refresh` changes. */
export function useDeviceConnection(deviceId: string, refresh?: unknown): DeviceConnection | null {
  const [c, setC] = useState<DeviceConnection | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api
      .deviceConnection(deviceId)
      .then((r) => !cancelled && setC(r.connection))
      .catch(() => !cancelled && setC(null));
    return () => {
      cancelled = true;
    };
  }, [deviceId, refresh]);
  return c;
}

/** "10:53" today, else "Fri 19:52". */
export function shortWhen(iso: string): string {
  const d = new Date(iso);
  const clock = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? `Today ${clock}` : `${d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} ${clock}`;
}

/** "under a minute", "4 min", "3 hours". */
export function durationWords(minutes: number): string {
  return minutes < 1 ? "under a minute" : minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} min`;
}
