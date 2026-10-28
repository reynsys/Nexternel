import { useEffect, useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api, type AreaRecord } from "../../api";
import { AREA } from "../../lib/area-labels";
import { ButtonRow } from "../../components/ButtonRow";
import { useLiveChanges } from "../../lib/live-changes";
import { getDashboardIcon } from "../../lib/dashboard-icons";
import { DashboardIconPicker } from "../../components/DashboardIconPicker";
import { SidePanel } from "../../components/side-panel/SidePanel";
import { PanelTile } from "../../components/PanelTile";
import { contentSurfaceSx } from "../../skins/surfaceStyles";
import { ICON_SIZE } from "../../lib/appearance/type";

/** The standard icon of an area without its own. */
const AREA_ICON = "place";

type Editing = { id: string | null; name: string; description: string; icon: string };

/**
 * Areas: the rooms and places of the home, each a box drawn like a dashboard panel (title row with grip,
 * icon, name and device count; the devices listed inside). Drag a box by its title to change the order;
 * Edit opens the side panel (name, icon, description, delete).
 */
export function AreasPage() {
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [devicesByArea, setDevicesByArea] = useState<Map<string, string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  // Changes made on another screen show here straight away.
  useLiveChanges(["rooms", "devices", "cameras"], () => void load());
  async function load() {
    try {
      const [rooms, devices, cameras, me] = await Promise.all([
        api.rooms(),
        api.devices().catch(() => ({ devices: [] })),
        api.cameras().catch(() => ({ cameras: [] })),
        api.me(),
      ]);
      setAreas(rooms.rooms);
      const map = new Map<string, string[]>();
      const add = (areaId: string | null, name: string) => {
        if (!areaId) return;
        map.set(areaId, [...(map.get(areaId) ?? []), name]);
      };
      for (const d of devices.devices) add(d.roomId, d.name);
      for (const c of cameras.cameras) add(c.areaId, `${c.name} (camera)`);
      setDevicesByArea(map);
      setCanEdit(Boolean(me.user.permissions?.editAreas ?? me.user.isAdmin ?? me.user.role === "admin"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not load the ${AREA.plural.toLowerCase()}`);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setError("Give the area a name.");
      return;
    }
    setBusy(true);
    try {
      const body = { name, description: editing.description.trim() || null, icon: editing.icon === AREA_ICON ? null : editing.icon };
      if (editing.id) await api.updateRoom(editing.id, body);
      else await api.createRoom({ ...body, description: body.description ?? undefined });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the area");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing?.id) return;
    setBusy(true);
    try {
      await api.deleteRoom(editing.id);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the area");
    } finally {
      setBusy(false);
    }
  }

  /** Dropping one box on another puts it in that place; the new order is saved straight away. */
  async function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const order = areas.map((a) => a.id).filter((id) => id !== dragId);
    order.splice(order.indexOf(targetId), 0, dragId);
    setAreas(order.map((id) => areas.find((a) => a.id === id)!));
    setDragId(null);
    try {
      await api.reorderRooms(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the order");
      await load();
    }
  }

  const open = (a: AreaRecord | null) => {
    setAskDelete(false);
    setEditing(a ? { id: a.id, name: a.name, description: a.description ?? "", icon: a.icon ?? AREA_ICON } : { id: null, name: "", description: "", icon: AREA_ICON });
  };
  const editingArea = editing?.id ? areas.find((a) => a.id === editing.id) : null;
  const editingDevices = editing?.id ? devicesByArea.get(editing.id) ?? [] : [];

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">{AREA.plural}</Typography>
        {canEdit ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => open(null)}>
            {AREA.add}
          </Button>
        ) : null}
      </Stack>
      <Typography color="text.secondary">
        The rooms and places in your home.{canEdit ? " Drag a box by its title to change the order; Edit opens its settings." : ""}
      </Typography>
      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {areas.length === 0 ? (
        <Typography color="text.secondary">
          No {AREA.plural.toLowerCase()} yet.{canEdit ? ` Use “${AREA.add}” to create one.` : ""}
        </Typography>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 2 }}>
        {areas.map((a) => {
          const Icon = getDashboardIcon(a.icon ?? AREA_ICON);
          const devices = devicesByArea.get(a.id) ?? [];
          return (
            <Paper
              key={a.id}
              variant="outlined"
              onDragOver={(e) => canEdit && dragId && e.preventDefault()}
              onDrop={() => void drop(a.id)}
              sx={[
                {
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "var(--nx-panel-radius, 20px)",
                  border: "var(--nx-panel-border, 1px solid rgba(255,255,255,0.12))",
                  boxShadow: "var(--nx-panel-shadow, none)",
                  p: "var(--nx-panel-inset, 4px)",
                  gap: "6px",
                  opacity: dragId === a.id ? 0.5 : 1,
                  outline: editing?.id === a.id ? 2 : 0,
                  outlineColor: "primary.main",
                },
                contentSurfaceSx(),
              ]}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                draggable={canEdit}
                onDragStart={() => setDragId(a.id)}
                onDragEnd={() => setDragId(null)}
                sx={{ px: "var(--nx-title-inset, 8px)", minHeight: 44, cursor: canEdit ? "grab" : "default" }}
              >
                {canEdit ? (
                  <Tooltip title="Drag to change the order">
                    <DragIndicatorIcon sx={{ fontSize: ICON_SIZE.title, color: "text.secondary", ml: -0.5 }} />
                  </Tooltip>
                ) : null}
                <Icon sx={{ fontSize: ICON_SIZE.title, color: "primary.main" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap title={a.name}>
                    {a.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {devices.length} device{devices.length === 1 ? "" : "s"}
                    {/* A description that only repeats the name adds nothing. */}
                    {a.description && a.description.trim().toLowerCase() !== a.name.trim().toLowerCase() ? ` · ${a.description}` : ""}
                  </Typography>
                </Box>
                {canEdit ? (
                  <Tooltip title={`Edit ${a.name}`}>
                    <Button variant="outlined" size="small" aria-label={`Edit ${a.name}`} onClick={() => open(a)} sx={{ minWidth: 32, width: 32, height: 32, p: 0 }}>
                      <EditOutlinedIcon fontSize="small" />
                    </Button>
                  </Tooltip>
                ) : null}
              </Stack>
              <PanelTile sx={{ p: 1.5, minHeight: 72 }}>
                {devices.length ? (
                  <Stack component="ul" spacing={0.25} sx={{ m: 0, pl: 2.5 }}>
                    {devices.map((d) => (
                      <Typography key={d} component="li" variant="body2">
                        {d}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No devices here yet.
                  </Typography>
                )}
              </PanelTile>
            </Paper>
          );
        })}
      </Box>

      <SidePanel
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit ${editingArea?.name ?? AREA.singular.toLowerCase()}` : AREA.add}
        footer={
          <ButtonRow direction="row">
            <Button variant="outlined" fullWidth onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="contained" fullWidth disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : editing?.id ? "Save" : "Add"}
            </Button>
          </ButtonRow>
        }
      >
        {editing ? (
          <Stack spacing={3}>
            <TextField
              label="Name"
              size="small"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              autoFocus
              placeholder="e.g. Kitchen, Front Garden, Driveway"
              fullWidth
            />
            <DashboardIconPicker dense value={editing.icon} onChange={(icon) => setEditing({ ...editing, icon })} />
            <TextField
              label="Description (optional)"
              size="small"
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="e.g. Upstairs, next to the bathroom"
              fullWidth
            />
            {editing.id ? (
              <>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Devices here
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {editingDevices.length ? editingDevices.join(", ") : "None yet."} A device's area is chosen on the Devices page.
                  </Typography>
                </Box>
                <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                  {askDelete ? (
                    <>
                      <Typography variant="body2">
                        Delete “{editingArea?.name}”? Its devices keep working; they just have no area until you choose one.
                      </Typography>
                      <ButtonRow direction="row" sx={{ mt: 1 }}>
                        <Button variant="outlined" onClick={() => setAskDelete(false)}>
                          Keep it
                        </Button>
                        <Button variant="contained" color="error" disabled={busy} onClick={() => void remove()}>
                          Delete
                        </Button>
                      </ButtonRow>
                    </>
                  ) : (
                    <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setAskDelete(true)}>
                      Delete this area
                    </Button>
                  )}
                </Box>
              </>
            ) : null}
          </Stack>
        ) : null}
      </SidePanel>
    </Stack>
  );
}
