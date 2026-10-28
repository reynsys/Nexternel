import { ICON_SIZE } from "../../../lib/appearance/type";
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import type { CameraRecord, DeviceRecord } from "../../../api";
import {
  connectivityChipColor,
  connectivityLabel,
  deviceConnectivityState,
  esphomeProvisioningLifecycleLabel,
  formatLastSeen,
} from "../../../lib/device-utils";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import {
  deviceNeedsAttention,
  deviceTypeLabel,
  filterPhysicalDevices,
  groupDevicesByArea,
  isPhysicalDevice,
  OCTOPUS_SERVICE_ID,
  readCollapsedAreaKeys,
  type DeviceSelection,
  type StatusFilter,
  type TypeFilter,
  writeCollapsedAreaKeys,
} from "./device-nav-utils";
import {
  devicesNavItemSx,
  devicesPanelChromeSx,
  devicesPanelHeaderSx,
  devicesSectionHeaderSx,
} from "./devices-panel-styles";

type Props = {
  devices: DeviceRecord[];
  areas: { id: string; name: string }[];
  selection: DeviceSelection;
  onSelect: (selection: DeviceSelection) => void;
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
  octopusNeedsAttention: boolean;
  showOctopus: boolean;
  showConnectedServices: boolean;
  /** Network cameras, listed in their own group. */
  cameras: CameraRecord[];
};

function deviceRowSelected(selection: DeviceSelection, deviceId: string): boolean {
  return selection?.kind === "device" && selection.deviceId === deviceId;
}

function DeviceNavRow({
  device,
  selected,
  onClick,
}: {
  device: DeviceRecord;
  selected: boolean;
  onClick: () => void;
}) {
  const theme = useTheme();
  const lifecycle = esphomeProvisioningLifecycleLabel(device.esphomeLifecycleState);
  const connectivity = deviceConnectivityState(device);
  return (
    <ListItemButton
      selected={selected}
      onClick={onClick}
      sx={devicesNavItemSx(theme, selected)}
    >
      <ListItemText
        primary={
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight="fontWeightBold">
              {device.name}
            </Typography>
            {deviceNeedsAttention(device) && (
              <WarningAmberRoundedIcon color="warning" sx={{ fontSize: ICON_SIZE.inline }} />
            )}
          </Stack>
        }
        secondary={
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={connectivityLabel(connectivity)}
                color={connectivityChipColor(connectivity)}
                sx={{ height: 22, "& .MuiChip-label": { px: 1, typography: "caption" } }}
              />
              <Chip
                size="small"
                variant="outlined"
                label={deviceTypeLabel(device)}
                sx={{ height: 22, "& .MuiChip-label": { px: 1, typography: "caption" } }}
              />
              {lifecycle && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    device.esphomeLifecycleState === "error" ||
                    device.esphomeLifecycleState === "validation_failed" ||
                    device.esphomeLifecycleState === "configuration_missing"
                      ? "error"
                      : "default"
                  }
                  label={lifecycle}
                  sx={{ height: 22, "& .MuiChip-label": { px: 1, typography: "caption" } }}
                />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {device.sensors.length} sensor(s) · {device.relays.length} relay(s) ·{" "}
              {formatLastSeen(device.lastSeenAt)}
            </Typography>
          </Stack>
        }
      />
    </ListItemButton>
  );
}

function SectionHeader({
  title,
  open,
  onToggle,
  tone = "default",
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  tone?: "default" | "warning";
}) {
  const theme = useTheme();
  return (
    <Box sx={devicesSectionHeaderSx(theme)} onClick={onToggle}>
      <Typography
        variant="overline"
        sx={{
          letterSpacing: "0.06em",
          color: tone === "warning" ? "warning.main" : "text.secondary",
          fontWeight: "fontWeightBold",
        }}
      >
        {title}
      </Typography>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}

export function DeviceNavigator({
  devices,
  areas,
  selection,
  onSelect,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  octopusNeedsAttention,
  showOctopus,
  showConnectedServices,
  cameras,
}: Props) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(() => readCollapsedAreaKeys());
  const [needsAttentionOpen, setNeedsAttentionOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);
  const [camerasOpen, setCamerasOpen] = useState(true);

  useEffect(() => {
    writeCollapsedAreaKeys(collapsedAreas);
  }, [collapsedAreas]);

  const filterOpts = useMemo(
    () => ({ search, statusFilter, typeFilter }),
    [search, statusFilter, typeFilter]
  );

  const filteredDevices = useMemo(
    () => filterPhysicalDevices(devices, filterOpts),
    [devices, filterOpts]
  );

  const attentionDevices = useMemo(
    () =>
      devices.filter(
        (d) => deviceNeedsAttention(d) && filterPhysicalDevices([d], filterOpts).length > 0
      ),
    [devices, filterOpts]
  );

  const areaGroups = useMemo(
    () => (statusFilter === "needs_attention" ? [] : groupDevicesByArea(filteredDevices, areas)),
    [filteredDevices, areas, statusFilter]
  );

  const physicalCount = devices.filter(isPhysicalDevice).length;
  const q = search.trim().toLowerCase();
  const shownCameras =
    (typeFilter === "all" || typeFilter === "camera") && statusFilter !== "needs_attention"
      ? cameras.filter((c) => !q || `${c.name} ${c.areaName ?? ""}`.toLowerCase().includes(q))
      : [];
  const showServices = showOctopus && showConnectedServices && (typeFilter === "all" || typeFilter === "service");
  // Only the kinds of device this home has are offered in the Type choice.
  const kinds: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    ...(devices.some((d) => isPhysicalDevice(d) && (d.firmwareType || "esphome") === "esphome") ? [{ value: "esphome" as const, label: "ESPHome boards" }] : []),
    ...(devices.some((d) => d.firmwareType === "shelly") ? [{ value: "shelly" as const, label: "Shelly switches" }] : []),
    ...(cameras.length ? [{ value: "camera" as const, label: "Cameras" }] : []),
    ...(showOctopus && showConnectedServices ? [{ value: "service" as const, label: "Online services" }] : []),
  ];
  const total = physicalCount + cameras.length;

  function toggleArea(key: string) {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const showAttentionSection =
    statusFilter === "all" || statusFilter === "needs_attention"
      ? attentionDevices.length > 0
      : false;

  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box sx={devicesPanelHeaderSx(theme)}>
        <Typography variant="subtitle1">
          Device list
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {total} device{total === 1 ? "" : "s"}
        </Typography>
      </Box>

      <Box sx={{ px: 2, pt: 2, pb: 1.5, flexShrink: 0, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            placeholder="Search devices…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: <SearchRoundedIcon fontSize="small" color="action" sx={{ mr: 1 }} />,
            }}
          />
          <Stack direction="row" spacing={1}>
            <FormControl size="small" fullWidth>
              <InputLabel id="device-status-filter">Status</InputLabel>
              <Select
                labelId="device-status-filter"
                label="Status"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="online">Online</MenuItem>
                <MenuItem value="no_recent_data">No recent data</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
                <MenuItem value="needs_attention">Needs attention</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel id="device-type-filter">Type</InputLabel>
              <Select
                labelId="device-type-filter"
                label="Type"
                value={typeFilter}
                onChange={(e) => onTypeFilterChange(e.target.value as TypeFilter)}
              >
                {kinds.map((k) => (
                  <MenuItem key={k.value} value={k.value}>
                    {k.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", py: 0.5 }}>
        {showAttentionSection && (
          <Box>
            <SectionHeader
              title={`Needs attention (${attentionDevices.length})`}
              open={needsAttentionOpen}
              onToggle={() => setNeedsAttentionOpen((v) => !v)}
              tone="warning"
            />
            <Collapse in={needsAttentionOpen}>
              <List disablePadding>
                {attentionDevices.map((d) => (
                  <DeviceNavRow
                    key={`attention-${d.id}`}
                    device={d}
                    selected={deviceRowSelected(selection, d.id)}
                    onClick={() => onSelect({ kind: "device", deviceId: d.id })}
                  />
                ))}
              </List>
            </Collapse>
          </Box>
        )}

        {showServices && (
          <Box>
            <SectionHeader
              title="Online services"
              open={servicesOpen}
              onToggle={() => setServicesOpen((v) => !v)}
            />
            <Collapse in={servicesOpen}>
              <List disablePadding>
                <ListItemButton
                  selected={
                    selection?.kind === "service" && selection.serviceId === OCTOPUS_SERVICE_ID
                  }
                  onClick={() => onSelect({ kind: "service", serviceId: OCTOPUS_SERVICE_ID })}
                  sx={devicesNavItemSx(
                    theme,
                    selection?.kind === "service" && selection.serviceId === OCTOPUS_SERVICE_ID
                  )}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Typography variant="body2" fontWeight="fontWeightBold">
                          Octopus Home Mini
                        </Typography>
                        {octopusNeedsAttention && (
                          <WarningAmberRoundedIcon color="warning" sx={{ fontSize: ICON_SIZE.inline }} />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        Online service · energy use from Octopus
                      </Typography>
                    }
                  />
                </ListItemButton>
              </List>
            </Collapse>
          </Box>
        )}

        {areaGroups.map((group) => {
          const collapsed = collapsedAreas.has(group.key);
          return (
            <Box key={group.key}>
              <SectionHeader
                title={`${group.label} (${group.devices.length})`}
                open={!collapsed}
                onToggle={() => toggleArea(group.key)}
              />
              <Collapse in={!collapsed}>
                <List disablePadding>
                  {group.devices.map((d) => (
                    <DeviceNavRow
                      key={d.id}
                      device={d}
                      selected={deviceRowSelected(selection, d.id)}
                      onClick={() => onSelect({ kind: "device", deviceId: d.id })}
                    />
                  ))}
                </List>
              </Collapse>
            </Box>
          );
        })}

        {shownCameras.length > 0 && (
          <Box>
            <SectionHeader title={`Cameras (${shownCameras.length})`} open={camerasOpen} onToggle={() => setCamerasOpen((v) => !v)} />
            <Collapse in={camerasOpen}>
              <List disablePadding>
                {shownCameras.map((c) => {
                  const on = selection?.kind === "camera" && selection.cameraId === c.id;
                  return (
                    <ListItemButton key={c.id} selected={on} onClick={() => onSelect({ kind: "camera", cameraId: c.id })} sx={devicesNavItemSx(theme, on)}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="fontWeightBold">
                            {c.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Camera · {c.areaName ?? "no area"}
                            {c.enabled ? "" : " · off"}
                          </Typography>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        )}

        {filteredDevices.length === 0 && shownCameras.length === 0 && !showServices && !showAttentionSection && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: "center" }}>
            No devices match your filters.
          </Typography>
        )}

        {statusFilter === "needs_attention" &&
          attentionDevices.length === 0 &&
          filteredDevices.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: "center" }}>
              No devices need attention.
            </Typography>
          )}

        {total === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: "center" }}>
            No devices yet. Use Add device to add one.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
