import { CODE_TEXT } from "../../lib/appearance/type";
import { CameraPane } from "./devices/CameraPane";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
import {
  api,
  type CameraRecord,
  type DeviceRecord,
  type EsphomeCatalogEntry,
} from "../../api";
import { AREA } from "../../lib/area-labels";
import { useConfirm } from "../../components/confirm";
import { EsphomeAddDeviceWizard } from "./EsphomeAddDeviceWizard";
import { EsphomeDevicePanelDialog } from "./EsphomeDevicePanelDialog";
import { BoardUpdatesCard } from "./devices/BoardUpdatesCard";
import { DeviceDetailPane } from "./devices/DeviceDetailPane";
import { DeviceNavigator } from "./devices/DeviceNavigator";
import { useCapabilityValues } from "./devices/use-capability-values";
import { useBoardUpdates } from "../../lib/board-updates";
import { ReadingSettingsDialog, type ReadingToEdit } from "./devices/ReadingSettingsDialog";
import {
  isPhysicalDevice,
  parseSelectionFromSearchParams,
  selectionToSearchParams,
  type DeviceSelection,
  type StatusFilter,
} from "./devices/device-nav-utils";
import { insetSx } from "../../skins/surfaceStyles";
import { ButtonRow } from "../../components/ButtonRow";
import { useLiveChanges } from "../../lib/live-changes";

type AreaOption = { id: string; name: string };

/** Device settings: only everyday things. The technical address is how Nexternel recognises the board. */
const emptyForm = {
  name: "",
  roomId: "",
  isEnabled: true,
};

const emptyShellyForm = {
  name: "",
  roomId: "",
  mqttTopicPrefix: "",
  shellyModelId: "switch_1",
  shellyGen: 2 as 1 | 2,
};

type ShellyModelOption = {
  id: string;
  label: string;
  switchCount: number;
  hint: string;
};

type DiscoveredShellyRow = {
  topicPrefix: string;
  model: string | null;
  app: string | null;
  mac: string | null;
  gen: number | null;
  version: string | null;
  ip: string | null;
  suggestedSwitchCount: number;
  suggestedModelId: string;
  suggestedGen: 1 | 2;
  switchCountProbed: boolean;
  alreadyRegistered: boolean;
};

export function DevicesPage() {
  const { confirm } = useConfirm();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [catalog, setCatalog] = useState<EsphomeCatalogEntry[]>([]);
  const [catalogHint, setCatalogHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingReading, setEditingReading] = useState<ReadingToEdit | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hostname, setHostname] = useState("localhost");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardImportFile, setWizardImportFile] = useState<string | null>(null);
  const [wizardEditDeviceId, setWizardEditDeviceId] = useState<string | null>(null);
  const [shellyDialogOpen, setShellyDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [shellyForm, setShellyForm] = useState(emptyShellyForm);
  const [shellyModels, setShellyModels] = useState<ShellyModelOption[]>([]);
  const [discoveredShellies, setDiscoveredShellies] = useState<DiscoveredShellyRow[]>(
    []
  );
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRecord | null>(null);
  const [deleteYamlToo, setDeleteYamlToo] = useState(false);
  const [addDeviceChooserOpen, setAddDeviceChooserOpen] = useState(false);
  const [esphomePanelMode, setEsphomePanelMode] = useState<"usb" | "file">("usb");
  const [esphomePanelDevice, setEsphomePanelDevice] = useState<DeviceRecord | null>(null);
  const [systems, setSystems] = useState<{ id: string; label: string }[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const capabilityValues = useCapabilityValues();
  const { boards: boardStatuses } = useBoardUpdates();
  const [octopusNeedsAttention, setOctopusNeedsAttention] = useState(false);
  const [cameras, setCameras] = useState<CameraRecord[]>([]);

  const selection = useMemo(
    () => parseSelectionFromSearchParams(searchParams),
    [searchParams]
  );

  const setSelection = useCallback(
    (next: DeviceSelection) => {
      setSearchParams(selectionToSearchParams(next), { replace: true });
    },
    [setSearchParams]
  );

  const selectedDevice = useMemo(() => {
    if (selection?.kind !== "device") return null;
    return devices.find((d) => d.id === selection.deviceId) ?? null;
  }, [devices, selection]);

  useEffect(() => {
    setHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!selection) return;
    if (selection.kind === "device" && devices.length > 0) {
      if (!devices.some((d) => d.id === selection.deviceId)) {
        setSelection(null);
      }
    }
  }, [devices, selection, setSelection]);

  // Changes made on another screen show here straight away.
  useLiveChanges(["devices", "capabilities", "rooms", "cameras"], () => void load());
  async function load() {
    void api
      .cameras()
      .then((r) => setCameras(r.cameras))
      .catch(() => setCameras([]));
    try {
      const [devRes, roomRes, me, catRes] = await Promise.all([
        api.devices(),
        api.rooms(),
        api.me(),
        api.esphomeCatalog().catch(() => ({
          configs: [],
          esphomeDirHint: null,
          yamlStatus: undefined,
          pruned: [],
        })),
      ]);
      setDevices(devRes.devices);
      setAreas(roomRes.rooms.map((r) => ({ id: r.id, name: r.name })));
      setIsAdmin(Boolean(me.user.permissions?.editDevices ?? me.user.isAdmin ?? me.user.role === "admin"));
      if (me.user.permissions?.editDevices ?? me.user.isAdmin ?? me.user.role === "admin") {
        const sysRes = await api.v4Systems({ catalog: true });
        setSystems(
          sysRes.systems
            .filter((s) => s.operatorVisible !== false && s.tier !== "deprecated")
            .map((s) => ({ id: s.id, label: s.label }))
        );
        try {
          const octRes = await api.octopusSettings();
          setOctopusNeedsAttention(
            Boolean(octRes.settings.enabled && octRes.settings.lastError)
          );
        } catch {
          setOctopusNeedsAttention(false);
        }
      } else {
        setSystems([]);
        setOctopusNeedsAttention(false);
      }
      setCatalog(catRes.configs);
      setCatalogHint(catRes.esphomeDirHint);
      if (catRes.yamlStatus?.markedMissing?.length) {
        setInfo(
          `YAML missing on server for ${catRes.yamlStatus.markedMissing.length} device(s): ${catRes.yamlStatus.markedMissing.map((p) => p.name).join(", ")}`
        );
      } else if (catRes.yamlStatus?.restored?.length) {
        setInfo(
          `YAML restored for ${catRes.yamlStatus.restored.length} device(s): ${catRes.yamlStatus.restored.map((p) => p.name).join(", ")}`
        );
      } else if (catRes.pruned?.length) {
        setInfo(
          `YAML missing on server for ${catRes.pruned.length} device(s): ${catRes.pruned.map((p) => p.name).join(", ")}`
        );
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load();
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const unregistered = useMemo(
    () => catalog.filter((c) => !c.registered),
    [catalog]
  );

  function openAddDeviceChooser() {
    setAddDeviceChooserOpen(true);
  }

  function openAddDeviceWizard(fileName?: string) {
    setAddDeviceChooserOpen(false);
    setWizardEditDeviceId(null);
    setWizardImportFile(fileName ?? null);
    setWizardOpen(true);
  }

  function openEditBuilder(d: DeviceRecord) {
    setWizardEditDeviceId(d.id);
    setWizardImportFile(null);
    setWizardOpen(true);
  }

  async function adoptToBuilder(d: DeviceRecord) {
    const mode = d.esphomeManagementMode ?? "imported";
    const confirmMessage =
      mode === "advanced"
        ? `“${d.name}” uses a hand-edited file. Adopting replaces that file with the Nexternel firmware. The sensor stays. Install the new file on the board afterwards. Continue?`
        : `Adopt “${d.name}” into Nexternel? The firmware file will be replaced with the Nexternel one. The sensor stays. Install that file on the board afterwards.`;
    if (!window.confirm(confirmMessage)) return;

    setBusy(true);
    setError(null);
    try {
      const adopted = await api.esphomeAdoptManaged(d.id);
      setInfo(
        adopted.firmwareReplaced
          ? `Adopted ${d.name}. Its firmware file now matches Nexternel. Install it on the board to replace the previous firmware.`
          : `Adopted ${d.name}. This file uses hardware the shared firmware cannot represent yet, so the file was left as it is.`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move it to Nexternel");
    } finally {
      setBusy(false);
    }
  }

  function openShellyCreate() {
    setAddDeviceChooserOpen(false);
    setShellyForm(emptyShellyForm);
    setDiscoveredShellies([]);
    setShellyDialogOpen(true);
    void api
      .shellyModels()
      .then((res) => setShellyModels(res.models))
      .catch(() => setShellyModels([]));
  }

  async function onDiscoverShellies() {
    setDiscoverBusy(true);
    setError(null);
    try {
      const res = await api.shellyDiscover({ timeoutMs: 5000 });
      setDiscoveredShellies(res.devices);
      if (res.devices.length === 0) {
        setInfo(
          "No Shelly devices answered. Check MQTT is enabled on the Shelly and pointed at this server."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setDiscoverBusy(false);
    }
  }

  function adoptDiscoveredShelly(d: DiscoveredShellyRow) {
    const label =
      d.app || d.model || d.topicPrefix.replace(/^shelly/i, "Shelly ");
    setShellyForm((f) => ({
      ...f,
      name: f.name.trim() || label,
      mqttTopicPrefix: d.topicPrefix,
      shellyModelId: d.suggestedModelId || "switch_1",
      shellyGen: d.suggestedGen ?? 2,
    }));
  }

  async function onSaveShelly(e: FormEvent) {
    e.preventDefault();
    if (!shellyForm.name.trim() || !shellyForm.mqttTopicPrefix.trim()) {
      setError("Name and device ID are required");
      return;
    }
    setBusy(true);
    try {
      const model = shellyModels.find((m) => m.id === shellyForm.shellyModelId);
      await api.createDevice({
        name: shellyForm.name.trim(),
        roomId: shellyForm.roomId || null,
        mqttTopicPrefix: shellyForm.mqttTopicPrefix.trim().replace(/\/+$/, ""),
        firmwareType: "shelly",
        shellyModelId: shellyForm.shellyModelId,
        shellySwitchCount: model?.switchCount ?? 1,
        shellyGen: shellyForm.shellyGen,
      });
      setShellyDialogOpen(false);
      setShellyForm(emptyShellyForm);
      setDiscoveredShellies([]);
      const channels = model?.switchCount ?? 1;
      setInfo(
        channels > 1
          ? `Shelly added with ${channels} switches. Dashboard → Edit → Add panel → Controls.`
          : "Shelly added. Dashboard → Edit → Add panel → Controls."
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(device: DeviceRecord) {
    setEditing(device);
    setForm({ name: device.name, roomId: device.roomId ?? "", isEnabled: device.isEnabled });
    setDialogOpen(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!form.name.trim()) {
      setError("Give the device a name");
      return;
    }
    setBusy(true);
    try {
      await api.updateDevice(editing.id, {
        name: form.name.trim(),
        roomId: form.roomId || null,
        isEnabled: form.isEnabled,
      });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setInfo("Device settings saved");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeOrphanYaml(entry: EsphomeCatalogEntry) {
    const ok = await confirm({
      title: "Remove YAML file?",
      message:
        `Remove esphome/${entry.yamlPath} from the server? This only deletes the YAML file — it does not remove a registered Nexternel device.`,
      confirmLabel: "Remove file",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteEsphomeYaml(entry.yamlPath);
      setInfo(`Removed esphome/${entry.yamlPath}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove YAML failed");
    } finally {
      setBusy(false);
    }
  }

  async function restoreYaml(d: DeviceRecord) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.esphomeRestoreYaml(d.id);
      setInfo(`Regenerated ${res.yamlPath} for ${d.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not recreate the settings file");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const managed = deleteTarget.esphomeManagementMode === "managed";
      await api.deleteDevice(deleteTarget.id, {
        deleteYaml: managed ? true : deleteYamlToo,
      });
      if (selection?.kind === "device" && selection.deviceId === deleteTarget.id) {
        setSelection(null);
      }
      setDeleteTarget(null);
      setInfo(`Deleted ${deleteTarget.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(device: DeviceRecord) {
    try {
      await api.updateDevice(device.id, { isEnabled: !device.isEnabled });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }


  async function syncEsphome(device: DeviceRecord) {
    setBusy(true);
    try {
      const res = await api.syncDeviceEsphome(device.id);
      const pruneParts: string[] = [];
      if (res.removedRelays > 0) pruneParts.push(`${res.removedRelays} relay(s)`);
      if (res.removedSensors > 0) pruneParts.push(`${res.removedSensors} sensor(s)`);
      const pruneNote =
        pruneParts.length > 0 ? ` — removed ${pruneParts.join(", ")} not in YAML` : "";
      setInfo(
        `Synced ${device.name} from ${res.yamlFile}.yaml — ${res.totalRelays} relay(s), ${res.sensorsInYaml.length} sensor(s) in YAML${pruneNote}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ESPHome sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadFirmware(device: DeviceRecord) {
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await api.esphomeDownloadFirmware(device.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setInfo(
        `Downloaded ${filename}. Open ESPHome Web Installer, Connect USB, Install, and select this .bin file.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Firmware download failed");
    } finally {
      setBusy(false);
    }
  }

  async function updateCapabilitySystem(capabilityId: string, systemId: string | null) {
    try {
      await api.v4UpdateCapabilitySystem(capabilityId, systemId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }


  async function removeEntity(kind: "sensor" | "relay", deviceId: string, entityId: string, name: string) {
    const label = kind === "relay" ? "relay" : "sensor";
    const ok = await confirm({
      title: `Remove ${label}?`,
      message: `Remove ${label} “${name}” from this device? Dashboard bindings to it will stop working until you sync again.`,
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      if (kind === "relay") await api.deleteRelay(deviceId, entityId);
      else await api.deleteSensor(deviceId, entityId);
      setInfo(`Removed ${label} "${name}"`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  const physicalDeviceCount = devices.filter(isPhysicalDevice).length;
  const showConnectedServices = true;
  const showNavigator = !isNarrow || !selection;
  const showDetail = !isNarrow || Boolean(selection);

  const detailActions = {
    onEdit: openEdit,
    onToggleEnabled: toggleEnabled,
    onRestoreYaml: restoreYaml,
    onEditBuilder: openEditBuilder,
    onAdoptToBuilder: adoptToBuilder,
    onOpenEsphomePanel: (d: DeviceRecord, mode: "usb" | "file" = "usb") => {
      setEsphomePanelMode(mode);
      setEsphomePanelDevice(d);
    },
    onSyncEsphome: syncEsphome,
    onDownloadFirmware: downloadFirmware,
    onDelete: (d: DeviceRecord) => {
      setDeleteYamlToo(false);
      setDeleteTarget(d);
    },
    onUpdateCapabilitySystem: updateCapabilitySystem,
    onEditReading: setEditingReading,
    onRemoveEntity: removeEntity,
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        gap={1}
      >
        <Typography variant="h4">Devices</Typography>
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
          {isAdmin && (
            <>
              <Button variant="contained" onClick={() => openAddDeviceChooser()}>
                Add device
              </Button>
            </>
          )}
        </ButtonRow>
      </Stack>

      <Typography color="text.secondary">
        Everything Nexternel talks to: ESPHome boards, Shelly switches, cameras and online services. Pick one to see its readings,
        switches and settings.
      </Typography>

      <BoardUpdatesCard canEdit={isAdmin} />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {info && (
        <Alert severity="success" onClose={() => setInfo(null)}>
          {info}
        </Alert>
      )}
      {catalogHint && <Alert severity="warning">{catalogHint}</Alert>}

      {isAdmin && unregistered.length > 0 && (
        <Card sx={{ p: 2 }}>
          <Typography variant="subtitle1">
            ESPHome files not added yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Board files found in the server's esphome folder that are not devices in Nexternel yet. Add one, or remove a file left over
            from a test or a deleted device.
          </Typography>
          <Stack spacing={1}>
            {unregistered.map((entry) => (
              <Stack
                key={entry.yamlPath}
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                gap={1}
                sx={[{ px: 1.5, py: 1 }, insetSx()]}
              >
                <Box>
                  <Typography fontWeight="fontWeightMedium">
                    {entry.suggestion?.esphomeName || entry.fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontFamily={CODE_TEXT.fontFamily}>
                    esphome/{entry.yamlPath}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary" fontFamily={CODE_TEXT.fontFamily}>
                    {entry.mqttTopicPrefix}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {entry.sensorCount} sensor(s), {entry.relayCount} relay(s)
                  </Typography>
                </Box>
                <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => openAddDeviceWizard(entry.fileName)}
                  >
                    Add device
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={busy}
                    onClick={() => void removeOrphanYaml(entry)}
                  >
                    Remove file
                  </Button>
                </ButtonRow>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      {physicalDeviceCount === 0 && !isAdmin ? (
        <Typography color="text.secondary">No devices registered yet.</Typography>
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            minHeight: { md: 520 },
            height: { md: "calc(100vh - 280px)" },
            maxHeight: { md: 900 },
          }}
        >
          {showNavigator && (
            <Box
              sx={{
                width: { xs: "100%", md: 360 },
                flexShrink: 0,
                minHeight: { xs: 320, md: 0 },
                height: { md: "100%" },
              }}
            >
              <DeviceNavigator
                devices={devices}
                areas={areas}
                selection={selection}
                onSelect={setSelection}
                search={deviceSearch}
                onSearchChange={setDeviceSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                values={capabilityValues}
                boards={boardStatuses}
                octopusNeedsAttention={octopusNeedsAttention}
                showOctopus={isAdmin}
                showConnectedServices={showConnectedServices}
                cameras={cameras}
              />
            </Box>
          )}
          {showDetail && (
            <Box sx={{ flex: 1, minWidth: 0, minHeight: { xs: 360, md: 0 }, height: { md: "100%" } }}>
              {selection?.kind === "camera" ? (
                <Box sx={(t) => ({ height: "100%", overflow: "auto", borderRadius: "var(--nx-panel-radius, 20px)", border: t.nx.cardBorder, bgcolor: t.nxScheme.surface.panel })}>
                  <CameraPane
                    key={selection.cameraId}
                    cameraId={selection.cameraId}
                    onSaved={(id) => setSelection({ kind: "camera", cameraId: id })}
                    onDeleted={() => setSelection(null)}
                    onCancelNew={() => setSelection(null)}
                  />
                </Box>
              ) : (
              <DeviceDetailPane
                selection={selection}
                device={selectedDevice}
                isAdmin={isAdmin}
                busy={busy}
                hostname={hostname}
                systems={systems}
                showBack={isNarrow && Boolean(selection)}
                onBack={() => setSelection(null)}
                actions={detailActions}
                values={capabilityValues}
              />
              )}
            </Box>
          )}
        </Box>
      )}

      {isAdmin && (
        <EsphomeAddDeviceWizard
          open={wizardOpen}
          busy={busy}
          hostname={hostname}
          areas={areas}
          catalog={catalog}
          initialImportFile={wizardImportFile}
          editDeviceId={wizardEditDeviceId}
          onClose={() => {
            setWizardOpen(false);
            setWizardImportFile(null);
            setWizardEditDeviceId(null);
          }}
          onBusy={setBusy}
          onError={setError}
          onSuccess={setInfo}
          onCreated={() => load()}
          onOpenEsphomePanel={(deviceId) => {
            const device = devices.find((d) => d.id === deviceId);
            if (device) {
              setEsphomePanelDevice(device);
            } else {
              void api.devices().then((res) => {
                const found = res.devices.find((d) => d.id === deviceId);
                if (found) setEsphomePanelDevice(found);
              });
            }
            setWizardOpen(false);
            setWizardImportFile(null);
            setWizardEditDeviceId(null);
          }}
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !busy && setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(e) => void onSave(e)}>
          <DialogTitle>
            Device settings
            <Typography variant="body2" color="text.secondary">
              {editing?.name}
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="device-area">{AREA.singular}</InputLabel>
                <Select
                  labelId="device-area"
                  label={AREA.singular}
                  value={form.roomId}
                  onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                >
                  <MenuItem value="">No {AREA.singular.toLowerCase()}</MenuItem>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                  Its readings show this {AREA.singular.toLowerCase()} under their panels' titles.
                </Typography>
              </FormControl>
              <FormControlLabel
                control={<Switch checked={form.isEnabled} onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))} />}
                label={
                  <span>
                    Use this device
                    <Typography variant="caption" color="text.secondary" display="block">
                      Off: Nexternel ignores it until it is switched on again; nothing is deleted.
                    </Typography>
                  </span>
                }
              />
              <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Its technical address is fixed: it is how Nexternel recognises the device (Troubleshooting → Technical details).
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={busy}
                  onClick={() => {
                    if (!editing) return;
                    setDialogOpen(false);
                    setDeleteYamlToo(false);
                    setDeleteTarget(editing);
                  }}
                >
                  Delete device
                </Button>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={shellyDialogOpen}
        onClose={() => !busy && setShellyDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(e) => void onSaveShelly(e)}>
          <DialogTitle>Add Shelly</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                Shellies must use this server’s MQTT (same user/password as Nexternel).
                Use <strong>Search network</strong> to list devices that announce themselves, or
                paste the device ID manually. For older Gen&nbsp;1 devices (e.g. SHSW-1), choose
                <strong>Gen 1</strong> below.
              </Alert>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  disabled={busy || discoverBusy}
                  onClick={() => void onDiscoverShellies()}
                >
                  {discoverBusy ? "Searching…" : "Search network"}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Takes a few seconds
                </Typography>
              </Stack>

              {discoveredShellies.length > 0 && (
                <Paper variant="inset" sx={{ maxHeight: 200, overflow: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Device</TableCell>
                        <TableCell>Gen</TableCell>
                        <TableCell>Channels</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discoveredShellies.map((d) => (
                        <TableRow key={d.topicPrefix} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="fontWeightBold">
                              {d.app || d.model || d.topicPrefix}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {d.topicPrefix}
                              {d.alreadyRegistered ? " · already added" : ""}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {d.suggestedGen === 1 ? "1" : "2+"}
                          </TableCell>
                          <TableCell>
                            {d.suggestedSwitchCount}
                            {d.switchCountProbed ? "" : " (guess)"}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              disabled={d.alreadyRegistered || busy}
                              onClick={() => adoptDiscoveredShelly(d)}
                            >
                              Add
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}

              <TextField
                label="Display name"
                value={shellyForm.name}
                onChange={(e) => setShellyForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
                placeholder="Living room light"
              />
              <FormControl fullWidth size="small">
                <InputLabel id="shelly-area">{AREA.singular}</InputLabel>
                <Select
                  labelId="shelly-area"
                  label={AREA.singular}
                  value={shellyForm.roomId}
                  onChange={(e) =>
                    setShellyForm((f) => ({ ...f, roomId: e.target.value }))
                  }
                >
                  <MenuItem value="">— None —</MenuItem>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="shelly-gen">Shelly generation</InputLabel>
                <Select
                  labelId="shelly-gen"
                  label="Shelly generation"
                  value={shellyForm.shellyGen}
                  onChange={(e) =>
                    setShellyForm((f) => ({
                      ...f,
                      shellyGen: Number(e.target.value) as 1 | 2,
                    }))
                  }
                >
                  <MenuItem value={2}>Gen 2+ (Plus, Mini Gen3, Pro, …)</MenuItem>
                  <MenuItem value={1}>Gen 1 (SHSW-1, Shelly 2.5, …)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Shelly device ID"
                value={shellyForm.mqttTopicPrefix}
                onChange={(e) =>
                  setShellyForm((f) => ({ ...f, mqttTopicPrefix: e.target.value }))
                }
                required
                fullWidth
                placeholder={
                  shellyForm.shellyGen === 1
                    ? "shelly1-B929CC"
                    : "shelly1minig3-xxxxxxxxxxxx"
                }
                helperText={
                  shellyForm.shellyGen === 1
                    ? "Device ID from the Shelly web UI (shellies/… prefix is added automatically)"
                    : "MQTT topic prefix from the Shelly — or pick one from Search network"
                }
              />
              <FormControl fullWidth size="small">
                <InputLabel id="shelly-model">Switches on this device</InputLabel>
                <Select
                  labelId="shelly-model"
                  label="Switches on this device"
                  value={shellyForm.shellyModelId}
                  onChange={(e) =>
                    setShellyForm((f) => ({ ...f, shellyModelId: e.target.value }))
                  }
                >
                  {(shellyModels.length
                    ? shellyModels
                    : [
                        {
                          id: "switch_1",
                          label: "1 switch",
                          switchCount: 1,
                          hint: "",
                        },
                        {
                          id: "switch_2",
                          label: "2 switches",
                          switchCount: 2,
                          hint: "",
                        },
                        {
                          id: "switch_3",
                          label: "3 switches",
                          switchCount: 3,
                          hint: "",
                        },
                        {
                          id: "switch_4",
                          label: "4 switches",
                          switchCount: 4,
                          hint: "",
                        },
                      ]
                  ).map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.label}
                      {m.hint ? ` — ${m.hint}` : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShellyDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={busy || discoverBusy}>
              {busy ? "Saving…" : "Add Shelly"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={addDeviceChooserOpen}
        onClose={() => setAddDeviceChooserOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Add device</DialogTitle>
        <DialogContent>
          <ButtonRow sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              What would you like to add?
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.5, px: 2 }}
              onClick={() => openAddDeviceWizard()}
            >
              <Stack alignItems="flex-start" spacing={0.25}>
                <Typography fontWeight="fontWeightBold">ESPHome board</Typography>
                <Typography variant="caption" color="text.secondary">
                  An ESP32 / ESP8266 board — Nexternel writes, builds and installs its firmware
                </Typography>
              </Stack>
            </Button>
            <Button
              variant="outlined"
              fullWidth
              sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.5, px: 2 }}
              onClick={() => openShellyCreate()}
            >
              <Stack alignItems="flex-start" spacing={0.25}>
                <Typography fontWeight="fontWeightBold">Shelly switch</Typography>
                <Typography variant="caption" color="text.secondary">
                  A Shelly switch or plug — found on your network, or entered by hand
                </Typography>
              </Stack>
            </Button>
            <Button
              variant="outlined"
              fullWidth
              sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.5, px: 2 }}
              onClick={() => {
                setAddDeviceChooserOpen(false);
                setSelection({ kind: "camera", cameraId: "new" });
              }}
            >
              <Stack alignItems="flex-start" spacing={0.25}>
                <Typography fontWeight="fontWeightBold">Camera</Typography>
                <Typography variant="caption" color="text.secondary">
                  A network camera's live picture
                </Typography>
              </Stack>
            </Button>
            <Typography variant="caption" color="text.secondary">
              Online services such as Octopus energy are set up in their own settings; more kinds of devices come as Extensions (Settings →
              Extensions).
            </Typography>
          </ButtonRow>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDeviceChooserOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {isAdmin && (
        <EsphomeDevicePanelDialog
          open={Boolean(esphomePanelDevice)}
          mode={esphomePanelMode}
          device={esphomePanelDevice}
          busy={busy}
          onClose={() => setEsphomePanelDevice(null)}
          onBusy={setBusy}
          onError={setError}
          onSuccess={setInfo}
          onUpdated={async () => {
            await load();
            if (esphomePanelDevice) {
              const res = await api.devices();
              const updated = res.devices.find((d) => d.id === esphomePanelDevice.id);
              if (updated) setEsphomePanelDevice(updated);
            }
          }}
        />
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !busy && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete device</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              Delete <strong>{deleteTarget?.name}</strong> and all its sensors/relays? This cannot be
              undone.
            </Typography>
            {deleteTarget &&
              (deleteTarget.firmwareType || "esphome") === "esphome" &&
              deleteTarget.esphomeManagementMode === "managed" && (
                <Typography variant="body2" color="text.secondary">
                  The managed ESPHome YAML file on the server will also be deleted.
                </Typography>
              )}
            {deleteTarget &&
              (deleteTarget.firmwareType || "esphome") === "esphome" &&
              deleteTarget.esphomeManagementMode !== "managed" && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={deleteYamlToo}
                      onChange={(e) => setDeleteYamlToo(e.target.checked)}
                    />
                  }
                  label="Also delete ESPHome YAML file on server"
                />
              )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy}
            onClick={() => void onDelete()}
          >
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
      <ReadingSettingsDialog
        reading={editingReading}
        onClose={() => setEditingReading(null)}
        onSaved={() => void load()}
      />
    </Stack>
  );
}
