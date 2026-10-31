import { useEffect, useState, type ReactNode } from "react";
import { Alert, Box, Button, Stack, Tab, Tabs, Typography, useTheme } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import DevicesOtherRoundedIcon from "@mui/icons-material/DevicesOtherRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import type { Capability, DeviceRecord } from "../../../api";
import { ICON_SIZE } from "../../../lib/appearance/type";
import { AREA } from "../../../lib/area-labels";
import { esphomeDashboardUrl } from "../../../lib/device-utils";
import { openEsphome } from "../../../lib/esphome-open";
import { useBoardUpdates } from "../../../lib/board-updates";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";
import { OctopusSettingsCard } from "../OctopusSettingsCard";
import type { DeviceSelection } from "./device-nav-utils";
import type { ReadingToEdit } from "./ReadingSettingsDialog";
import { deviceStatus } from "./device-summary";
import { InfoCard, KIND_WORD, KindTile, StatusWord, shortWhen, useDeviceConnection, type DeviceKind } from "./DeviceBits";
import { DeviceOverviewTab } from "./DeviceOverviewTab";
import { DeviceReadingsTab } from "./DeviceReadingsTab";
import { DeviceTroubleshootingTab } from "./DeviceTroubleshootingTab";
import {
  devicesContainedButton,
  devicesOutlinedButton,
  devicesPanelBodySx,
  devicesPanelChromeSx,
  devicesPanelHeaderSx,
} from "./devices-panel-styles";

type TabKey = "overview" | "readings" | "troubleshooting" | "advanced";

export type DeviceDetailActions = {
  /** Device settings (name, area, use this device, delete). */
  onEdit: (device: DeviceRecord) => void;
  onToggleEnabled: (device: DeviceRecord) => void;
  onRestoreYaml: (device: DeviceRecord) => void;
  onEditBuilder: (device: DeviceRecord) => void;
  onAdoptToBuilder: (device: DeviceRecord) => void;
  onOpenEsphomePanel: (device: DeviceRecord, mode?: "usb" | "file") => void;
  onSyncEsphome: (device: DeviceRecord) => void;
  onDownloadFirmware: (device: DeviceRecord) => void;
  onDelete: (device: DeviceRecord) => void;
  onUpdateCapabilitySystem: (capabilityId: string, systemId: string | null) => void;
  /** Open a reading's Name & icon settings. */
  onEditReading: (reading: ReadingToEdit) => void;
  onRemoveEntity: (kind: "sensor" | "relay", deviceId: string, entityId: string, name: string) => void;
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
  /** Current values of every reading and switch. */
  values: Map<string, Capability>;
};

/** The page of something that is not a board or switch (an online service). */
function DetailShell({ title, subtitle, kind, showBack, onBack, children }: { title: string; subtitle?: string; kind?: DeviceKind; showBack?: boolean; onBack?: () => void; children: ReactNode }) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box sx={devicesPanelHeaderSx(theme)}>
        {showBack && onBack ? (
          <Button {...devicesOutlinedButton} startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ mb: 1 }}>
            Back
          </Button>
        ) : null}
        <Stack direction="row" spacing={1.5} alignItems="center">
          {kind ? <KindTile kind={kind} size={48} /> : null}
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Box>
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
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", p: 4, minHeight: 280 }}>
        <DevicesOtherRoundedIcon sx={{ fontSize: ICON_SIZE.empty, color: "text.disabled", mb: 1.5 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Choose a device
        </Typography>
        <Typography variant="body2" color="text.secondary" maxWidth={320}>
          Pick one from the list to see its readings, switches and settings.
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * A device's page: its picture, name, area and kind, its status in one word, Device settings; then
 * Overview, Readings & switches, Troubleshooting and Advanced. The same frame for every kind of device.
 */
export function DeviceDetailPane({ selection, device, isAdmin, busy, hostname, systems, showBack, onBack, actions, values }: Props) {
  const theme = useTheme();
  const contentSurface = useContentSurfaceSx();
  const { boards } = useBoardUpdates();
  const [tab, setTab] = useState<TabKey>("overview");
  const selectionKey = selection?.kind === "device" ? `device:${selection.deviceId}` : selection?.kind === "service" ? "service" : "none";
  useEffect(() => setTab("overview"), [selectionKey]);
  const connection = useDeviceConnection(device?.id ?? "", `${device?.id}:${device?.connectivityState}:${device?.lastSeenAt?.slice(0, 15)}`);

  if (!selection) return <EmptyDetail />;
  if (selection.kind === "service") {
    return (
      <DetailShell title="Octopus Home Mini" subtitle="Online service · energy use from Octopus" kind="service" showBack={showBack} onBack={onBack}>
        <OctopusSettingsCard embedded />
      </DetailShell>
    );
  }
  if (!device) {
    return (
      <DetailShell title="Device" showBack={showBack} onBack={onBack}>
        <Alert severity="warning">This device is no longer there. It may have been deleted.</Alert>
      </DetailShell>
    );
  }

  const kind: DeviceKind = device.firmwareType === "shelly" ? "switch" : "board";
  const isBoard = kind === "board";
  const board = boards?.find((b) => b.deviceId === device.id) ?? null;
  const status = deviceStatus(device, board);
  const since = connection?.since && status.tone !== "off" ? ` since ${shortWhen(connection.since).replace(/^Today /, "")}` : "";

  return (
    <Box sx={devicesPanelChromeSx(contentSurface, theme)}>
      <Box sx={devicesPanelHeaderSx(theme)}>
        {showBack ? (
          <Button {...devicesOutlinedButton} startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ mb: 1 }}>
            Back
          </Button>
        ) : null}
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <KindTile kind={kind} size={48} />
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography variant="h6" noWrap>
              {device.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {device.roomName ?? `No ${AREA.singular.toLowerCase()}`} · {KIND_WORD[kind]}
            </Typography>
          </Box>
          <StatusWord word={`${status.word}${status.tone === "ok" || status.tone === "bad" ? since : ""}`} tone={status.tone} emphasis />
          {isAdmin ? (
            <Button {...devicesOutlinedButton} startIcon={<TuneRoundedIcon />} onClick={() => actions.onEdit(device)}>
              Device settings
            </Button>
          ) : null}
        </Stack>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v: TabKey) => setTab(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ px: 1 }}
      >
        <Tab value="overview" label="Overview" />
        <Tab value="readings" label="Readings & switches" />
        <Tab value="troubleshooting" label="Troubleshooting" />
        {isBoard && isAdmin ? <Tab value="advanced" label="Advanced" /> : null}
      </Tabs>

      <Box sx={{ ...devicesPanelBodySx(), pt: 2 }}>
        {tab === "overview" ? (
          <DeviceOverviewTab
            device={device}
            isAdmin={isAdmin}
            busy={busy}
            connection={connection}
            values={values}
            onUsb={() => actions.onOpenEsphomePanel(device, "usb")}
            onShowReadings={() => setTab("readings")}
          />
        ) : null}
        {tab === "readings" ? (
          <DeviceReadingsTab
            device={device}
            isAdmin={isAdmin}
            values={values}
            systems={systems}
            onEditReading={actions.onEditReading}
            onRemove={(k, id, eid, name) => void actions.onRemoveEntity(k, id, eid, name)}
            onSetSystem={(cap, sys) => void actions.onUpdateCapabilitySystem(cap, sys)}
          />
        ) : null}
        {tab === "troubleshooting" ? <DeviceTroubleshootingTab device={device} connection={connection} board={board} /> : null}
        {tab === "advanced" && isBoard && isAdmin ? <AdvancedTab device={device} hostname={hostname} busy={busy} actions={actions} /> : null}
      </Box>
    </Box>
  );
}

/** Advanced (boards): how its ESPHome settings are kept, and the ESPHome tools for experienced users. */
function AdvancedTab({ device, hostname, busy, actions }: { device: DeviceRecord; hostname: string; busy: boolean; actions: DeviceDetailActions }) {
  const managed = device.esphomeManagementMode === "managed";
  return (
    <Stack spacing={2}>
      <InfoCard title="Settings kept by">
        <Typography variant="body2" color="text.secondary">
          {managed
            ? "Nexternel keeps this board's settings: change them with Edit configuration."
            : "The board's own ESPHome settings file. Nexternel can take it over, so you change its settings here instead."}
        </Typography>
        <ButtonRow direction="row">
          {managed ? (
            <Button {...devicesContainedButton} startIcon={<EditRoundedIcon />} disabled={busy} onClick={() => actions.onEditBuilder(device)}>
              Edit configuration
            </Button>
          ) : (
            <Button {...devicesContainedButton} disabled={busy} onClick={() => void actions.onAdoptToBuilder(device)}>
              Manage in Nexternel
            </Button>
          )}
        </ButtonRow>
      </InfoCard>
      <InfoCard title="ESPHome — for experienced users">
        <Typography variant="body2" color="text.secondary">
          The board's ESPHome settings file and tools. Everyday updates are on the Overview tab (Update board).
        </Typography>
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
          <Button {...devicesOutlinedButton} startIcon={<EditRoundedIcon />} disabled={busy} onClick={() => actions.onOpenEsphomePanel(device, "file")}>
            Open settings file
          </Button>
          <Button {...devicesOutlinedButton} startIcon={<SyncRoundedIcon />} disabled={busy} onClick={() => void actions.onSyncEsphome(device)}>
            Reload from ESPHome
          </Button>
          <Button {...devicesOutlinedButton} onClick={() => void openEsphome(esphomeDashboardUrl(hostname, device.esphomeName || device.slug))} endIcon={<OpenInNewRoundedIcon />}>
            Open in ESPHome
          </Button>
          {device.esphomeLifecycleState === "configuration_missing" && managed ? (
            <Button {...devicesOutlinedButton} disabled={busy} onClick={() => void actions.onRestoreYaml(device)}>
              Recreate settings file
            </Button>
          ) : null}
          <Button {...devicesOutlinedButton} startIcon={<DownloadRoundedIcon />} disabled={busy} onClick={() => void actions.onDownloadFirmware(device)}>
            Download firmware
          </Button>
        </ButtonRow>
      </InfoCard>
    </Stack>
  );
}
