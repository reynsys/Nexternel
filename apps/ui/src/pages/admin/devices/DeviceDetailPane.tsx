import { ICON_SIZE, CODE_TEXT } from "../../../lib/appearance/type";
import { useEffect, useState, type ReactNode } from "react";
import { openEsphome } from "../../../lib/esphome-open";
import { ConnectionHistory } from "./ConnectionHistory";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  useTheme,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import DevicesOtherRoundedIcon from "@mui/icons-material/DevicesOtherRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import type { DeviceRecord } from "../../../api";
import { AREA } from "../../../lib/area-labels";
import {
  connectivityChipColor,
  connectivityLabel,
  deviceConnectivityState,
  esphomeDashboardUrl,
  esphomeProvisioningLifecycleLabel,
  formatLastSeen,
} from "../../../lib/device-utils";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { OctopusSettingsCard } from "../OctopusSettingsCard";
import { deviceTypeLabel, type DeviceSelection } from "./device-nav-utils";
import { ItemIcon } from "../../../lib/icons/ItemIcon";
import type { ReadingToEdit } from "./ReadingSettingsDialog";
import {
  devicesActionGroupSx,
  devicesContainedButton,
  devicesOutlinedButton,
  devicesPanelBodySx,
  devicesPanelChromeSx,
  devicesPanelHeaderSx,
} from "./devices-panel-styles";
import { insetSx } from "../../../skins/surfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";

type TabKey = "overview" | "capabilities" | "configuration" | "advanced";

export type DeviceDetailActions = {
  onEdit: (device: DeviceRecord) => void;
  onToggleEnabled: (device: DeviceRecord) => void;
  onRestoreYaml: (device: DeviceRecord) => void;
  onEditBuilder: (device: DeviceRecord) => void;
  onAdoptToBuilder: (device: DeviceRecord) => void;
  onOpenEsphomePanel: (device: DeviceRecord) => void;
  onSyncEsphome: (device: DeviceRecord) => void;
  onDownloadFirmware: (device: DeviceRecord) => void;
  onDelete: (device: DeviceRecord) => void;
  onUpdateCapabilitySystem: (capabilityId: string, systemId: string | null) => void;
  /** Open a reading's Name & icon settings. */
  onEditReading: (reading: ReadingToEdit) => void;
  onRemoveEntity: (
    kind: "sensor" | "relay",
    deviceId: string,
    entityId: string,
    name: string
  ) => void;
};

type Props = {
  selection: DeviceSelection;
  device: DeviceRecord | null;
  isAdmin: boolean;
  busy: boolean;
  hostname: string;
  systems: { id: string; label: string }[];
  showBack: boolean;
  onBack: () => void;
  actions: DeviceDetailActions;
};

function DetailShell({
  title,
  subtitle,
  showBack,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box sx={devicesPanelHeaderSx(theme)}>
        <Stack spacing={0.5}>
          {showBack && onBack && (
            <Button
              {...devicesOutlinedButton}
              startIcon={<ArrowBackRoundedIcon />}
              onClick={onBack}
              sx={{ alignSelf: "flex-start", mb: 0.5 }}
            >
              Back
            </Button>
          )}
          <Typography variant="subtitle1">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Stack>
      </Box>
      <Box sx={devicesPanelBodySx()}>{children}</Box>
    </Box>
  );
}

function EmptyDetail() {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          p: 4,
          minHeight: 280,
        }}
      >
        <DevicesOtherRoundedIcon sx={{ fontSize: ICON_SIZE.empty, color: "text.disabled", mb: 1.5 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Select a device
        </Typography>
        <Typography variant="body2" color="text.secondary" maxWidth={320}>
          Choose a device or connected service from the list to view details and actions.
        </Typography>
      </Box>
    </Box>
  );
}

function StatusChips({ device }: { device: DeviceRecord }) {
  const lifecycle = esphomeProvisioningLifecycleLabel(device.esphomeLifecycleState);
  const connectivity = deviceConnectivityState(device);
  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      <Chip
        size="small"
        label={connectivityLabel(connectivity)}
        color={connectivityChipColor(connectivity)}
      />
      <Chip size="small" variant="outlined" label={deviceTypeLabel(device)} />
      {!device.isEnabled && <Chip size="small" label="Disabled" color="warning" />}
      {lifecycle && (
        <Chip
          size="small"
          variant="outlined"
          color={
            device.esphomeLifecycleState === "error" ||
            device.esphomeLifecycleState === "validation_failed" ||
            device.esphomeLifecycleState === "configuration_missing"
              ? "error"
              : device.esphomeLifecycleState === "connecting"
                ? "warning"
                : "default"
          }
          label={lifecycle}
        />
      )}
      <Chip
        size="small"
        variant="outlined"
        label={device.roomName ?? `No ${AREA.singular}`}
      />
    </Stack>
  );
}

function OverviewTab({
  device,
  isAdmin,
  hostname,
  busy,
  actions,
}: {
  device: DeviceRecord;
  isAdmin: boolean;
  hostname: string;
  busy: boolean;
  actions: DeviceDetailActions;
}) {
  const theme = useTheme();
  const connectivity = deviceConnectivityState(device);
  const isEsphome = (device.firmwareType || "esphome") === "esphome";

  return (
    <ButtonRow>
      {device.esphomeLifecycleState === "configuration_missing" && (
        <Alert severity="warning">
          ESPHome YAML file is missing on the server. The device row is kept in Nexternel.
          {device.esphomeManagementMode === "managed"
            ? " Use Regenerate YAML to recreate it from the builder configuration, or restore the file on the server."
            : " Restore the YAML file on the server, or delete this registration."}
        </Alert>
      )}

      <Box sx={devicesActionGroupSx(theme)}>
        <Typography variant="subtitle2" gutterBottom>
          Connection
        </Typography>
        <Typography variant="body2" fontFamily={CODE_TEXT.fontFamily} color="text.secondary">
          {device.mqttTopicPrefix}
          {device.ipAddress ? ` · ${device.ipAddress}` : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {device.sensors.length} sensor(s) · {device.relays.length} relay(s) · last seen{" "}
          {formatLastSeen(device.lastSeenAt)}
          {device.esphomeLifecycleState === "connecting" && connectivity !== "online"
            ? " · waiting for device on MQTT"
            : ""}
        </Typography>
        <ConnectionHistory deviceId={device.id} refresh={connectivity} />
      </Box>

      {isAdmin && (
        <Box sx={devicesActionGroupSx(theme)}>
          <Typography variant="subtitle2" gutterBottom>
            Device
          </Typography>
          <ButtonRow direction="row" flexWrap="wrap" useFlexGap alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={device.isEnabled}
                  onChange={() => void actions.onToggleEnabled(device)}
                  size="small"
                />
              }
              label="Enabled"
            />
            <Button
              {...devicesContainedButton}
              startIcon={<EditRoundedIcon />}
              onClick={() => actions.onEdit(device)}
            >
              Edit device
            </Button>
            <Button
              {...devicesOutlinedButton}
              color="error"
              startIcon={<DeleteRoundedIcon />}
              onClick={() => actions.onDelete(device)}
            >
              Delete
            </Button>
          </ButtonRow>
        </Box>
      )}

      {isAdmin && isEsphome && (
        <Box sx={devicesActionGroupSx(theme)}>
          <Typography variant="subtitle2" gutterBottom>
            ESPHome
          </Typography>
          <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
            {device.esphomeLifecycleState === "configuration_missing" &&
              device.esphomeManagementMode === "managed" && (
                <Button
                  {...devicesOutlinedButton}
                  disabled={busy}
                  onClick={() => void actions.onRestoreYaml(device)}
                >
                  Regenerate YAML
                </Button>
              )}
            {device.esphomeManagementMode === "managed" ? (
              <Button
                {...devicesOutlinedButton}
                startIcon={<EditRoundedIcon />}
                disabled={busy}
                onClick={() => actions.onEditBuilder(device)}
              >
                Edit configuration
              </Button>
            ) : (
              <Button
                {...devicesOutlinedButton}
                disabled={busy}
                onClick={() => void actions.onAdoptToBuilder(device)}
              >
                Adopt to builder
              </Button>
            )}
            <Button
              {...devicesOutlinedButton}
              startIcon={<BuildRoundedIcon />}
              disabled={busy}
              onClick={() => actions.onOpenEsphomePanel(device)}
            >
              Install firmware
            </Button>
            <Button
              {...devicesOutlinedButton}
              startIcon={<SyncRoundedIcon />}
              disabled={busy}
              onClick={() => void actions.onSyncEsphome(device)}
            >
              Re-read its ESPHome file
            </Button>
            <Button
              {...devicesOutlinedButton}
              startIcon={<DownloadRoundedIcon />}
              disabled={busy}
              onClick={() => void actions.onDownloadFirmware(device)}
            >
              Download firmware (.bin)
            </Button>
            <Button
              {...devicesOutlinedButton}
              onClick={() => void openEsphome(esphomeDashboardUrl(hostname, device.esphomeName || device.slug))}
              endIcon={<OpenInNewRoundedIcon />}
            >
              Open in ESPHome
            </Button>
          </ButtonRow>
        </Box>
      )}
    </ButtonRow>
  );
}

function CapabilitiesTab({
  device,
  isAdmin,
  systems,
  actions,
}: {
  device: DeviceRecord;
  isAdmin: boolean;
  systems: { id: string; label: string }[];
  actions: DeviceDetailActions;
}) {
  return (
    <TableContainer sx={[{ overflow: "hidden" }, insetSx()]}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Entity</TableCell>
            <TableCell>Type</TableCell>
            {isAdmin && <TableCell>Function</TableCell>}
            <TableCell>MQTT</TableCell>
            {isAdmin && <TableCell align="right">Actions</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
        {device.sensors.map((s) => (
          <TableRow key={s.id} hover>
            <TableCell>
              <ReadingName name={s.customName ?? s.name} deviceName={s.customName ? s.name : null} icon={s.icon} kind={s.sensorType} />
            </TableCell>
            <TableCell>sensor · {s.sensorType}</TableCell>
            {isAdmin && (
              <TableCell sx={{ minWidth: 140 }}>
                {s.capabilityId ? (
                  <FormControl size="small" fullWidth>
                    <Select
                      value={s.systemId ?? ""}
                      displayEmpty
                      onChange={(e) =>
                        void actions.onUpdateCapabilitySystem(
                          s.capabilityId!,
                          e.target.value ? String(e.target.value) : null
                        )
                      }
                    >
                      <MenuItem value="">—</MenuItem>
                      {systems.map((sys) => (
                        <MenuItem key={sys.id} value={sys.id}>
                          {sys.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Not ready yet
                  </Typography>
                )}
              </TableCell>
            )}
            <TableCell>
              <Typography variant="caption" fontFamily={CODE_TEXT.fontFamily}>
                {s.mqttStateTopic}
              </Typography>
            </TableCell>
            {isAdmin && (
              <TableCell align="right">
                <ButtonRow direction="row" justifyContent="flex-end">
                  <Button
                    {...devicesOutlinedButton}
                    disabled={!s.capabilityId}
                    onClick={() =>
                      s.capabilityId &&
                      actions.onEditReading({
                        capabilityId: s.capabilityId,
                        originalName: s.name,
                        customName: s.customName ?? null,
                        icon: s.icon ?? null,
                        kind: s.sensorType,
                        unit: s.unit ?? null,
                      })
                    }
                  >
                    Name &amp; icon
                  </Button>
                  <Button
                    {...devicesOutlinedButton}
                    color="error"
                    onClick={() => void actions.onRemoveEntity("sensor", device.id, s.id, s.name)}
                  >
                    Remove
                  </Button>
                </ButtonRow>
              </TableCell>
            )}
          </TableRow>
        ))}
        {device.relays.map((r) => (
          <TableRow key={r.id} hover>
            <TableCell>
              <ReadingName
                name={`${r.customName ?? r.name}${r.lastState ? ` (${r.lastState})` : ""}`}
                deviceName={r.customName ? r.name : null}
                icon={r.icon}
                kind="switch"
              />
            </TableCell>
            <TableCell>relay</TableCell>
            {isAdmin && (
              <TableCell sx={{ minWidth: 140 }}>
                {r.capabilityId ? (
                  <FormControl size="small" fullWidth>
                    <Select
                      value={r.systemId ?? ""}
                      displayEmpty
                      onChange={(e) =>
                        void actions.onUpdateCapabilitySystem(
                          r.capabilityId!,
                          e.target.value ? String(e.target.value) : null
                        )
                      }
                    >
                      <MenuItem value="">—</MenuItem>
                      {systems.map((sys) => (
                        <MenuItem key={sys.id} value={sys.id}>
                          {sys.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Not ready yet
                  </Typography>
                )}
              </TableCell>
            )}
            <TableCell>
              <Typography variant="caption" fontFamily={CODE_TEXT.fontFamily}>
                {r.mqttStateTopic}
              </Typography>
            </TableCell>
            {isAdmin && (
              <TableCell align="right">
                <ButtonRow direction="row" justifyContent="flex-end">
                  <Button
                    {...devicesOutlinedButton}
                    disabled={!r.capabilityId}
                    onClick={() =>
                      r.capabilityId &&
                      actions.onEditReading({
                        capabilityId: r.capabilityId,
                        originalName: r.name,
                        customName: r.customName ?? null,
                        icon: r.icon ?? null,
                        kind: "switch",
                      })
                    }
                  >
                    Name &amp; icon
                  </Button>
                  <Button
                    {...devicesOutlinedButton}
                    color="error"
                    onClick={() => void actions.onRemoveEntity("relay", device.id, r.id, r.name)}
                  >
                    Remove
                  </Button>
                </ButtonRow>
              </TableCell>
            )}
          </TableRow>
        ))}
        {device.sensors.length === 0 && device.relays.length === 0 && (
          <TableRow>
            <TableCell colSpan={isAdmin ? 5 : 3}>
              <Typography variant="body2" color="text.secondary">
                No sensors or relays — import from ESPHome YAML or sync.
              </Typography>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    </TableContainer>
  );
}

function ConfigurationTab({
  device,
  isAdmin,
  busy,
  actions,
}: {
  device: DeviceRecord;
  isAdmin: boolean;
  busy: boolean;
  actions: DeviceDetailActions;
}) {
  const theme = useTheme();
  const isEsphome = (device.firmwareType || "esphome") === "esphome";
  if (!isEsphome) {
    return (
      <Typography variant="body2" color="text.secondary">
        Configuration tools are available for ESPHome devices.
      </Typography>
    );
  }

  return (
    <Box sx={devicesActionGroupSx(theme)}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Management mode: <strong>{device.esphomeManagementMode ?? "imported"}</strong>
      </Typography>
      {isAdmin && (
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
          {device.esphomeManagementMode === "managed" ? (
            <Button
              {...devicesContainedButton}
              startIcon={<EditRoundedIcon />}
              disabled={busy}
              onClick={() => actions.onEditBuilder(device)}
            >
              Edit configuration
            </Button>
          ) : (
            <Button
              {...devicesContainedButton}
              disabled={busy}
              onClick={() => void actions.onAdoptToBuilder(device)}
            >
              Adopt to builder
            </Button>
          )}
          <Button
            {...devicesOutlinedButton}
            startIcon={<BuildRoundedIcon />}
            disabled={busy}
            onClick={() => actions.onOpenEsphomePanel(device)}
          >
            ESPHome panel
          </Button>
          <Button
            {...devicesOutlinedButton}
            startIcon={<SyncRoundedIcon />}
            disabled={busy}
            onClick={() => void actions.onSyncEsphome(device)}
          >
            Re-read its ESPHome file
          </Button>
        </ButtonRow>
      )}
    </Box>
  );
}

function AdvancedTab({
  device,
  isAdmin,
  busy,
  actions,
}: {
  device: DeviceRecord;
  isAdmin: boolean;
  busy: boolean;
  actions: DeviceDetailActions;
}) {
  const theme = useTheme();
  const isEsphome = (device.firmwareType || "esphome") === "esphome";

  return (
    <ButtonRow>
      {isEsphome && isAdmin && (
        <Box sx={devicesActionGroupSx(theme)}>
          <Typography variant="subtitle2" gutterBottom>
            Maintenance
          </Typography>
          <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
            {device.esphomeLifecycleState === "configuration_missing" &&
              device.esphomeManagementMode === "managed" && (
                <Button
                  {...devicesOutlinedButton}
                  disabled={busy}
                  onClick={() => void actions.onRestoreYaml(device)}
                >
                  Regenerate YAML
                </Button>
              )}
            <Button
              {...devicesOutlinedButton}
              startIcon={<DownloadRoundedIcon />}
              disabled={busy}
              onClick={() => void actions.onDownloadFirmware(device)}
            >
              Download firmware (.bin)
            </Button>
          </ButtonRow>
        </Box>
      )}
      {isAdmin && (
        <Box sx={devicesActionGroupSx(theme)}>
          <Typography variant="subtitle2" gutterBottom color="error">
            Danger zone
          </Typography>
          <Button
            {...devicesOutlinedButton}
            color="error"
            startIcon={<DeleteRoundedIcon />}
            onClick={() => actions.onDelete(device)}
          >
            Delete device
          </Button>
        </Box>
      )}
    </ButtonRow>
  );
}

export function DeviceDetailPane({
  selection,
  device,
  isAdmin,
  busy,
  hostname,
  systems,
  showBack,
  onBack,
  actions,
}: Props) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  const [tab, setTab] = useState<TabKey>("overview");
  const selectionKey =
    selection?.kind === "device"
      ? `device:${selection.deviceId}`
      : selection?.kind === "service"
        ? `service:${selection.serviceId}`
        : "none";

  useEffect(() => {
    setTab("overview");
  }, [selectionKey]);

  if (!selection) {
    return <EmptyDetail />;
  }

  if (selection.kind === "service") {
    return (
      <DetailShell
        title="Octopus Home Mini"
        subtitle="Connected service · Kraken API"
        showBack={showBack}
        onBack={onBack}
      >
        <OctopusSettingsCard embedded />
      </DetailShell>
    );
  }

  if (!device) {
    return (
      <DetailShell title="Device" showBack={showBack} onBack={onBack}>
        <Alert severity="warning">Device not found. It may have been deleted.</Alert>
      </DetailShell>
    );
  }

  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box sx={devicesPanelHeaderSx(theme)}>
        <Stack spacing={1}>
          {showBack && (
            <Button
              {...devicesOutlinedButton}
              startIcon={<ArrowBackRoundedIcon />}
              onClick={onBack}
              sx={{ alignSelf: "flex-start" }}
            >
              Back
            </Button>
          )}
          <Typography variant="subtitle1">
            {device.name}
          </Typography>
          <StatusChips device={device} />
        </Stack>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          px: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          minHeight: 44,
          "& .MuiTab-root": { minHeight: 44, textTransform: "none", fontWeight: "fontWeightBold" },
        }}
      >
        <Tab value="overview" label="Overview" />
        <Tab value="capabilities" label="Capabilities" />
        <Tab value="configuration" label="Configuration" />
        <Tab value="advanced" label="Advanced" />
      </Tabs>

      <Box sx={{ ...devicesPanelBodySx(), pt: 2 }}>
        {tab === "overview" && (
          <OverviewTab
            device={device}
            isAdmin={isAdmin}
            hostname={hostname}
            busy={busy}
            actions={actions}
          />
        )}
        {tab === "capabilities" && (
          <CapabilitiesTab device={device} isAdmin={isAdmin} systems={systems} actions={actions} />
        )}
        {tab === "configuration" && (
          <ConfigurationTab device={device} isAdmin={isAdmin} busy={busy} actions={actions} />
        )}
        {tab === "advanced" && (
          <AdvancedTab device={device} isAdmin={isAdmin} busy={busy} actions={actions} />
        )}
      </Box>
    </Box>
  );
}

/** A reading's name with its icon; when you renamed it, the device's own name underneath. */
function ReadingName({
  name,
  deviceName,
  icon,
  kind,
}: {
  name: string;
  deviceName: string | null;
  icon?: string | null;
  kind: string;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <ItemIcon iconId={icon} kind={kind} sx={{ fontSize: ICON_SIZE.title, color: "primary.main", mt: "1px" }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{name}</Typography>
        {deviceName && (
          <Typography variant="caption" color="text.secondary">
            Device: {deviceName}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
