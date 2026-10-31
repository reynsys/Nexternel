import { CODE_TEXT } from "../../../lib/appearance/type";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { InfoCard, KindTile, StatusWord } from "./DeviceBits";
import {
  api,
  type CameraBrandPreset,
  type CameraRecord,
} from "../../../api";
import { AREA } from "../../../lib/area-labels";
import { useLiveChanges } from "../../../lib/live-changes";

type AreaOption = { id: string; name: string };

const emptyForm = {
  name: "",
  streamId: "",
  areaId: "",
  enabled: true,
  sortOrder: "0",
  brandPreset: "",
  host: "",
  port: "554",
  path: "/ch01/1",
  username: "",
  password: "",
};

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * One camera on the Devices page: its details with Edit and Delete ("new" = adding a camera). The
 * camera editor opens as before.
 */
export type CameraPaneProps = { cameraId: string; onSaved: (id: string) => void; onDeleted: () => void; onCancelNew: () => void };

export function CameraPane(props: CameraPaneProps) {
  return <CamerasPage pane={props} />;
}

function CamerasPage({ pane }: { pane: CameraPaneProps }) {
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [presets, setPresets] = useState<CameraBrandPreset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CameraRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<CameraRecord | null>(null);

  // Changes made on another screen show here straight away.
  useLiveChanges(["cameras", "rooms"], () => void load());
  async function load() {
    try {
      const [camRes, roomRes, me, presetRes] = await Promise.all([
        api.cameras(),
        api.rooms(),
        api.me(),
        api.cameraPresets().catch(() => ({ presets: [] as CameraBrandPreset[] })),
      ]);
      setCameras(camRes.cameras);
      setAreas(roomRes.rooms.map((r) => ({ id: r.id, name: r.name })));
      setPresets(presetRes.presets);
      setCanEdit(
        Boolean(me.user.permissions?.editDevices ?? me.user.isAdmin ?? me.user.role === "admin")
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras");
    }
  }

  useEffect(() => {
    void load();
  }, []);
  // Adding a camera: the editor opens straight away.
  useEffect(() => {
    if (pane.cameraId === "new") openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane.cameraId]);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === form.brandPreset) ?? null,
    [presets, form.brandPreset]
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function fillFormFromCamera(cam: CameraRecord) {
    setForm({
      ...emptyForm,
      name: cam.name,
      streamId: cam.streamId,
      areaId: cam.areaId ?? "",
      enabled: cam.enabled,
      sortOrder: String(cam.sortOrder),
      host: cam.host ?? "",
      port: String(cam.port ?? 554),
      path: cam.path ?? "/ch01/1",
      username: cam.username ?? "",
      password: "",
    });
  }

  function openEdit(cam: CameraRecord) {
    setEditing(cam);
    fillFormFromCamera(cam);
    setDialogOpen(true);
    void api
      .getCamera(cam.id)
      .then((r) => {
        setEditing(r.camera);
        fillFormFromCamera(r.camera);
      })
      .catch(() => {
        /* keep list row data */
      });
  }

  function applyPresetPath() {
    if (!selectedPreset) return;
    setForm((f) => ({
      ...f,
      path: selectedPreset.pathTemplate.startsWith("/")
        ? selectedPreset.pathTemplate
        : `/${selectedPreset.pathTemplate}`,
    }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const streamId = form.streamId.trim() || slugFromName(form.name);
      const sortOrder = Number(form.sortOrder);
      const port = Number(form.port);
      if (!form.host.trim()) {
        setError("Camera IP / host is required");
        setBusy(false);
        return;
      }

      const body = {
        name: form.name.trim(),
        streamId,
        host: form.host.trim(),
        port: Number.isFinite(port) && port > 0 ? Math.trunc(port) : 554,
        path: form.path.trim() || "/",
        username: form.username.trim(),
        areaId: form.areaId.trim() || null,
        enabled: form.enabled,
        sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      };

      if (editing) {
        await api.updateCamera(editing.id, {
          ...body,
          ...(form.password ? { password: form.password } : {}),
        });
        setInfo(`Updated ${form.name.trim()}.`);
      } else {
        const created = await api.createCamera({
          ...body,
          password: form.password,
        });
        setInfo(`Added ${form.name.trim()}.`);
        setDialogOpen(false);
        await load();
        pane.onSaved(created.camera.id);
        return;
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.deleteCamera(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      pane.onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const cam = cameras.find((c) => c.id === pane.cameraId) ?? null;
  return (
    <Stack spacing={2} sx={{ p: 2 }}>
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
      {cam ? (
        <>
          {/* The same header as every device: picture, name, area and kind, status, settings. */}
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <KindTile kind="camera" size={48} />
            <Box sx={{ flex: 1, minWidth: 180 }}>
              <Typography variant="h6" noWrap>
                {cam.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {cam.areaName ?? `No ${AREA.singular.toLowerCase()}`} · Camera
              </Typography>
            </Box>
            <StatusWord word={cam.enabled ? "On" : "Switched off"} tone={cam.enabled ? "ok" : "off"} emphasis />
            {canEdit ? (
              <Button variant="outlined" startIcon={<TuneRoundedIcon />} onClick={() => openEdit(cam)}>
                Camera settings
              </Button>
            ) : null}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <InfoCard title="Live picture">
              <Typography variant="body2" color="text.secondary">
                {cam.enabled ? "On — shown in camera panels." : "Off — camera panels show nothing until it is switched on (Camera settings)."}
              </Typography>
            </InfoCard>
            <InfoCard title="Technical details">
              <Typography variant="caption" color="text.secondary">
                Address
              </Typography>
              <Typography variant="body2" fontFamily={CODE_TEXT.fontFamily} sx={{ wordBreak: "break-all" }}>
                {cam.connectionPreview || (cam.host ? `${cam.host}${cam.path ? cam.path : ""}` : cam.streamId)}
              </Typography>
            </InfoCard>
          </Box>
        </>
      ) : pane.cameraId !== "new" ? (
        <Typography color="text.secondary">This camera no longer exists.</Typography>
      ) : (
        <Typography color="text.secondary">Fill in the camera's details to add it.</Typography>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (busy) return;
          setDialogOpen(false);
          if (pane.cameraId === "new") pane.onCancelNew();
        }}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(e) => void onSave(e)}>
          <DialogTitle>{editing ? "Camera settings" : "Add camera"}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                A network camera's live picture. Enter its address, path and login separately — Nexternel builds the stream link, so any
                characters in the password are fine. For dashboard panels use the camera's smaller stream (often <b>/ch01/1</b>); <b>/0</b> is
                usually the full-size one.
              </Typography>
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    streamId:
                      !editing && (!f.streamId || f.streamId === slugFromName(f.name))
                        ? slugFromName(name)
                        : f.streamId,
                  }));
                }}
                required
                fullWidth
                autoFocus
                placeholder="e.g. Driveway"
              />
              <TextField
                label="Stream id (optional)"
                value={form.streamId}
                onChange={(e) => setForm((f) => ({ ...f, streamId: e.target.value }))}
                fullWidth
                helperText="A short name for the stream (letters, numbers, - and _). Filled in from the name if left empty."
              />
              <FormControl fullWidth>
                <InputLabel id="cam-area">{AREA.singular}</InputLabel>
                <Select
                  labelId="cam-area"
                  label={AREA.singular}
                  value={form.areaId}
                  onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="subtitle2">Connection</Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="cam-brand">Path preset (optional)</InputLabel>
                <Select
                  labelId="cam-brand"
                  label="Path preset (optional)"
                  value={form.brandPreset}
                  onChange={(e) => {
                    const id = e.target.value;
                    const p = presets.find((x) => x.id === id);
                    setForm((f) => ({
                      ...f,
                      brandPreset: id,
                      path: p
                        ? p.pathTemplate.startsWith("/")
                          ? p.pathTemplate
                          : `/${p.pathTemplate}`
                        : f.path,
                    }));
                  }}
                >
                  <MenuItem value="">
                    <em>None — type path yourself</em>
                  </MenuItem>
                  {presets.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedPreset && (
                <Typography variant="caption" color="text.secondary">
                  {selectedPreset.hint}
                </Typography>
              )}
              {selectedPreset && (
                <Button
                  size="small"
                  onClick={applyPresetPath}
                  sx={{ alignSelf: "flex-start" }}
                >
                  Use suggested address
                </Button>
              )}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  label="Camera IP / host"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  required
                  fullWidth
                  placeholder="192.168.1.50"
                />
                <TextField
                  label="Port"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                  sx={{ width: { sm: 120 } }}
                />
              </Stack>
              <TextField
                label="Path on the camera"
                value={form.path}
                onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                required
                fullWidth
                placeholder="/ch01/1"
                helperText="e.g. /ch01/1 (smaller stream), /ch02/1, /ch03/1 — without rtsp:// or the password"
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  label="Username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  fullWidth
                  autoComplete="off"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  fullWidth
                  autoComplete="new-password"
                  required={false}
                  helperText={
                    editing
                      ? editing.hasPassword
                        ? "Leave blank to keep the current password"
                        : "No password stored yet"
                      : "Any characters allowed — not put into a URL field"
                  }
                />
              </Stack>
              {editing?.connectionPreview && (
                <Typography variant="caption" color="text.secondary" fontFamily={CODE_TEXT.fontFamily}>
                  Preview: {editing.connectionPreview}
                </Typography>
              )}

              <TextField
                label="Order in camera lists"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={form.enabled}
                    onChange={(_, checked) => setForm((f) => ({ ...f, enabled: checked }))}
                  />
                }
                label="Live picture on"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            {editing ? (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteRoundedIcon />}
                disabled={busy}
                sx={{ mr: "auto" }}
                onClick={() => {
                  setDialogOpen(false);
                  setDeleteTarget(editing);
                }}
              >
                Delete camera
              </Button>
            ) : null}
            <Button
              variant="outlined"
              onClick={() => {
                setDialogOpen(false);
                if (pane.cameraId === "new") pane.onCancelNew();
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !busy && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete camera</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteTarget?.name}</strong>? Camera panels that show it will be empty until you choose another camera.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDeleteTarget(null)} disabled={busy}>
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
    </Stack>
  );
}
