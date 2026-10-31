import { useMemo } from "react";
import { Box, Chip, List, Stack, TextField, Typography, useTheme } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import type { BoardStatus, CameraRecord, Capability, DeviceRecord } from "../../../api";
import { deviceConnectivityState } from "../../../lib/device-utils";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { deviceMatchesSearch, isPhysicalDevice, OCTOPUS_SERVICE_ID, type DeviceSelection, type StatusFilter } from "./device-nav-utils";
import { deviceStatus, deviceSummary, type DeviceStatus } from "./device-summary";
import { DeviceRow, type DeviceKind } from "./DeviceBits";
import { devicesPanelChromeSx } from "./devices-panel-styles";

type Props = {
  devices: DeviceRecord[];
  areas: { id: string; name: string }[];
  selection: DeviceSelection;
  onSelect: (selection: DeviceSelection) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  octopusNeedsAttention: boolean;
  showOctopus: boolean;
  showConnectedServices: boolean;
  cameras: CameraRecord[];
  /** Current values of every reading and switch (live summaries). */
  values: Map<string, Capability>;
  /** ESPHome boards' update state ("Update ready"). */
  boards: BoardStatus[] | null;
};

type Entry = { key: string; kind: DeviceKind; name: string; summary: string; status: DeviceStatus; selection: DeviceSelection; attention: boolean; offline: boolean; search: string };

function sameSelection(a: DeviceSelection, b: DeviceSelection): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === "device" && b.kind === "device") return a.deviceId === b.deviceId;
  if (a.kind === "camera" && b.kind === "camera") return a.cameraId === b.cameraId;
  return a.kind === "service";
}

/**
 * The Devices list: everything grouped by area (online services last), each the same kind of row —
 * its picture, name, a short live summary and one status word. A device with a problem stays in its
 * area (amber or red word) and is never listed twice; the quick filters above show only those.
 */
export function DeviceNavigator({
  devices,
  areas,
  selection,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  octopusNeedsAttention,
  showOctopus,
  showConnectedServices,
  cameras,
  values,
  boards,
}: Props) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();

  const { groups, counts } = useMemo(() => {
    const byArea = new Map<string, Entry[]>();
    const add = (areaKey: string, e: Entry) => byArea.set(areaKey, [...(byArea.get(areaKey) ?? []), e]);
    const q = search.trim().toLowerCase();
    for (const d of devices.filter(isPhysicalDevice)) {
      const status = deviceStatus(d, boards?.find((b) => b.deviceId === d.id));
      add(d.roomId ?? "", {
        key: `d-${d.id}`,
        kind: d.firmwareType === "shelly" ? "switch" : "board",
        name: d.name,
        summary: deviceSummary(d, values),
        status,
        selection: { kind: "device", deviceId: d.id },
        attention: status.tone === "warn" || status.tone === "bad",
        offline: d.isEnabled && deviceConnectivityState(d) === "offline",
        search: deviceMatchesSearch(d, q) ? "" : "-",
      });
    }
    for (const c of cameras) {
      add(c.areaId ?? "", {
        key: `c-${c.id}`,
        kind: "camera",
        name: c.name,
        summary: c.enabled ? "Camera · live picture" : "Camera",
        status: c.enabled ? { word: "On", tone: "ok" } : { word: "Switched off", tone: "off" },
        selection: { kind: "camera", cameraId: c.id },
        attention: false,
        offline: false,
        search: !q || `${c.name} ${c.areaName ?? ""}`.toLowerCase().includes(q) ? "" : "-",
      });
    }
    const all = [...byArea.values()].flat();
    const services: Entry[] =
      showOctopus && showConnectedServices
        ? [
            {
              key: "s-octopus",
              kind: "service",
              name: "Octopus Home Mini",
              summary: "Energy use from Octopus",
              status: octopusNeedsAttention ? { word: "Needs attention", tone: "warn" } : { word: "Working", tone: "ok" },
              selection: { kind: "service", serviceId: OCTOPUS_SERVICE_ID },
              attention: octopusNeedsAttention,
              offline: false,
              search: !q || "octopus home mini energy".includes(q) ? "" : "-",
            },
          ]
        : [];
    const counts = {
      all: all.length + services.length,
      attention: [...all, ...services].filter((e) => e.attention).length,
      offline: all.filter((e) => e.offline).length,
    };
    const keep = (e: Entry) =>
      !e.search && (statusFilter === "needs_attention" ? e.attention : statusFilter === "offline" ? e.offline : true);
    const sortRows = (list: Entry[]) => list.filter(keep).sort((a, b) => a.name.localeCompare(b.name));
    const groups: { key: string; label: string; rows: Entry[] }[] = [];
    for (const a of areas) groups.push({ key: a.id, label: a.name, rows: sortRows(byArea.get(a.id) ?? []) });
    for (const [key, list] of byArea) {
      if (key && !areas.some((a) => a.id === key)) groups.push({ key, label: "Other area", rows: sortRows(list) });
    }
    groups.push({ key: "none", label: "No area", rows: sortRows(byArea.get("") ?? []) });
    groups.push({ key: "services", label: "Online services", rows: sortRows(services) });
    return { groups: groups.filter((g) => g.rows.length), counts };
  }, [devices, cameras, areas, values, boards, search, statusFilter, showOctopus, showConnectedServices, octopusNeedsAttention]);

  const filters: { value: StatusFilter; label: string; count: number; tone?: "warning" | "error" }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "needs_attention", label: "Needs attention", count: counts.attention, tone: "warning" },
    { value: "offline", label: "Offline", count: counts.offline, tone: "error" },
  ];

  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box sx={{ p: 1.75, flexShrink: 0, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack spacing={1.25}>
          <TextField
            size="small"
            placeholder="Search devices"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            fullWidth
            slotProps={{ input: { startAdornment: <SearchRoundedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> } }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap role="group" aria-label="Show">
            {filters.map((f) => (
              <Chip
                key={f.value}
                label={`${f.label} ${f.count}`}
                clickable
                color={statusFilter === f.value ? "primary" : f.count && f.tone ? f.tone : "default"}
                variant={statusFilter === f.value ? "filled" : "outlined"}
                aria-pressed={statusFilter === f.value}
                onClick={() => onStatusFilterChange(f.value)}
              />
            ))}
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 1, py: 0.5 }}>
        {groups.map((g) => (
          <Box key={g.key} sx={{ mb: 0.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: "block", px: 1, pt: 1, lineHeight: 1.6 }}>
              {g.label}
            </Typography>
            <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {g.rows.map((e) => (
                <DeviceRow
                  key={e.key}
                  kind={e.kind}
                  name={e.name}
                  summary={e.summary}
                  status={e.status}
                  selected={sameSelection(selection, e.selection)}
                  onClick={() => onSelect(e.selection)}
                />
              ))}
            </List>
          </Box>
        ))}
        {groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: "center" }}>
            {counts.all === 0
              ? "No devices yet. Use Add device to add one."
              : statusFilter === "needs_attention"
                ? "Nothing needs attention."
                : statusFilter === "offline"
                  ? "Nothing is offline."
                  : "No devices match your search."}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
