import { PageHeader } from "../../components/PageHeader";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { CameraPane } from "./devices/CameraPane";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography, useMediaQuery, useTheme } from "@mui/material";
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
  octopusState,
  parseSelectionFromSearchParams,
  selectionToSearchParams,
  type DeviceSelection,
  type OctopusState,
  type StatusFilter,
} from "./devices/device-nav-utils";
import { useLiveChanges } from "../../lib/live-changes";
import { AddDeviceDialog, type BringInState } from "./devices/AddDeviceDialog";
import { ButtonRow } from "../../components/ButtonRow";
import { DevicesWifiForm } from "../../components/DevicesWifi";
import WifiIcon from "@mui/icons-material/Wifi";
import type { FoundDevice } from "@nexternel/domain";

type AreaOption = { id: string; name: string };

/** Device settings: only everyday things. The technical address is how Nexternel recognises the board. */
const emptyForm = {
  name: "",
  roomId: "",
  isEnabled: true,
};

export function DevicesPage() {
  const { confirm } = useConfirm();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down("md"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [catalog, setCatalog] = useState<EsphomeCatalogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingReading, setEditingReading] = useState<ReadingToEdit | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hostname, setHostname] = useState("localhost");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardEditDeviceId, setWizardEditDeviceId] = useState<string | null>(null);
  const [editing, setEditing] = useState<DeviceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeviceRecord | null>(null);
  const [deleteYamlToo, setDeleteYamlToo] = useState(false);
  const [addDeviceChooserOpen, setAddDeviceChooserOpen] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [newCameraHost, setNewCameraHost] = useState<string | undefined>(undefined);
  const [esphomePanelMode, setEsphomePanelMode] = useState<"usb" | "file">("usb");
  const [esphomePanelDevice, setEsphomePanelDevice] = useState<DeviceRecord | null>(null);
  const [systems, setSystems] = useState<{ id: string; label: string }[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const capabilityValues = useCapabilityValues();
  const { boards: boardStatuses } = useBoardUpdates();
  const [octopus, setOctopus] = useState<OctopusState>("not_set_up");
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
          setOctopus(octopusState((await api.octopusSettings()).settings));
        } catch {
          setOctopus(octopusState(null));
        }
      } else {
        setSystems([]);
      }
      setCatalog(catRes.configs);
      if (catRes.yamlStatus?.markedMissing?.length) {
        setInfo(
          `Nexternel can't find the settings file for these boards: ${catRes.yamlStatus.markedMissing.map((p) => p.name).join(", ")}.`
        );
      } else if (catRes.yamlStatus?.restored?.length) {
        setInfo(
          `The settings file is back for: ${catRes.yamlStatus.restored.map((p) => p.name).join(", ")}.`
        );
      } else if (catRes.pruned?.length) {
        setInfo(
          `Nexternel can't find the settings file for these boards: ${catRes.pruned.map((p) => p.name).join(", ")}.`
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

  function openAddDeviceChooser() {
    setAddDeviceChooserOpen(true);
  }

  function openEditBuilder(d: DeviceRecord) {
    setWizardEditDeviceId(d.id);
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

  /** Search my home → Bring in: one device at a time, each reporting how it went. */
  async function bringInFound(
    found: FoundDevice[],
    report: (key: string, state: BringInState) => void,
    password?: string
  ) {
    for (const d of found) {
      report(d.key, { status: "working" });
      try {
        const res = await api.homeNetworkBringIn(d, password ? { password } : undefined);
        report(d.key, { status: "done", message: res.message });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Didn't work. Try again.";
        // 422: the device has its own password; devices_wifi_needed: the Wi-Fi for boards. The row asks for it.
        const { status, code } = err as { status?: number; code?: string | null };
        report(d.key, {
          status: code === "devices_wifi_needed" ? "wifi" : status === 422 ? "password" : "failed",
          message,
        });
      }
    }
    await load();
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
      if (res.removedRelays > 0) pruneParts.push(`${res.removedRelays} switch${res.removedRelays === 1 ? "" : "es"}`);
      if (res.removedSensors > 0) pruneParts.push(`${res.removedSensors} reading${res.removedSensors === 1 ? "" : "s"}`);
      const pruneNote =
        pruneParts.length > 0 ? ` — removed ${pruneParts.join(", ")} not in YAML` : "";
      setInfo(
        `Synced ${device.name} from ${res.yamlFile}.yaml — ${res.totalRelays} switch${res.totalRelays === 1 ? "" : "es"}, ${res.sensorsInYaml.length} reading${res.sensorsInYaml.length === 1 ? "" : "s"} in its settings file${pruneNote}`
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
    onReload: () => void load(),
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
      <PageHeader
        title="Devices"
        actions={
          isAdmin ? (
            <ButtonRow>
              <Button startIcon={<WifiIcon />} variant="outlined" onClick={() => setWifiOpen(true)}>
                Wi-Fi for devices
              </Button>
              <Button startIcon={<AddIcon />} variant="contained" onClick={() => openAddDeviceChooser()}>
                Add device
              </Button>
            </ButtonRow>
          ) : null
        }
      />

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

      {physicalDeviceCount === 0 && !isAdmin ? (
        <Typography color="text.secondary">No devices.</Typography>
      ) : (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            // The list and the details fill the screen: the page scrolls the boxes above away once, then
            // only the list and the details scroll (no second, half-hidden page scroll).
            minHeight: { md: 520 },
            height: { md: "calc(100dvh - 32px)" },
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
                octopus={octopus}
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
                    newHost={selection.cameraId === "new" ? newCameraHost : undefined}
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
          initialImportFile={null}
          editDeviceId={wizardEditDeviceId}
          onClose={() => {
            setWizardOpen(false);
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
              </FormControl>
              <FormControlLabel
                control={<Switch checked={form.isEnabled} onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))} />}
                label={
                  "Use this device"
                }
              />
              <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                <Button startIcon={<DeleteOutlineIcon />}
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
                  Remove device
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

      <Dialog open={wifiOpen} onClose={() => setWifiOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Wi-Fi for your devices</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Running boards keep their Wi-Fi until their next install.
            </Typography>
            <DevicesWifiForm idPrefix="devices-page-wifi" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWifiOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <AddDeviceDialog
        open={addDeviceChooserOpen}
        onClose={() => setAddDeviceChooserOpen(false)}
        areas={areas}
        onDeviceAdded={(id) => {
          // Select it once the list has it (selecting a device the list does not have yet clears the choice).
          void load().then(() => setSelection({ kind: "device", deviceId: id }));
        }}
        onAddCamera={(host) => {
          setNewCameraHost(host);
          setSelection({ kind: "camera", cameraId: "new" });
        }}
        onOpenExisting={(found) => {
          if (!found.alreadyIn) return;
          setSelection(
            found.alreadyIn.kind === "camera"
              ? { kind: "camera", cameraId: found.alreadyIn.id }
              : { kind: "device", deviceId: found.alreadyIn.id }
          );
        }}
        onBringIn={bringInFound}
      />

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
        <DialogTitle>Remove device</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              Remove <strong>{deleteTarget?.name}</strong> from Nexternel, with its readings and switches? This cannot be
              undone.
            </Typography>
            {deleteTarget?.zherodius ? (
              <Typography variant="body2" color="text.secondary">
                The device still lists this Nexternel. To remove it there: device's page, Settings → Nexternel, Unpair{" "}
                {deleteTarget.zherodius.hubName ?? "Nexternel"}.
              </Typography>
            ) : null}
            {deleteTarget &&
              (deleteTarget.firmwareType || "esphome") === "esphome" &&
              deleteTarget.esphomeManagementMode === "managed" && (
                <Typography variant="body2" color="text.secondary">
                  Nexternel's settings file for this board is removed too.
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
                  label="Also remove this board's ESPHome settings file from the server"
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
            {busy ? "Removing…" : "Remove"}
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
