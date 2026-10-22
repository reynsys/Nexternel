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
import type { DeviceRecord } from "../../../api";
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
}: Props) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(() => readCollapsedAreaKeys());
  const [needsAttentionOpen, setNeedsAttentionOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);

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
          {physicalCount} device{physicalCount === 1 ? "" : "s"}
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
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="esphome">ESPHome</MenuItem>
                <MenuItem value="shelly">Shelly</MenuItem>
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

        {showOctopus && showConnectedServices && (
          <Box>
            <SectionHeader
              title="Connected services"
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
                        Kraken API polling · no LAN MQTT
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

        {filteredDevices.length === 0 && !showAttentionSection && (
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

        {physicalCount === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2.5, textAlign: "center" }}>
            No physical devices registered yet.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
