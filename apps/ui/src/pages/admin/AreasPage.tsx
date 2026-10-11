import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import { api } from "../../api";
import { AREA } from "../../lib/area-labels";

type AreaRow = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  deviceCount: number;
};

const emptyForm = {
  name: "",
  description: "",
  sortOrder: "0",
};

export function AreasPage() {
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AreaRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AreaRow | null>(null);

  async function load() {
    try {
      const [res, me] = await Promise.all([api.rooms(), api.me()]);
      setAreas(res.rooms);
      setIsAdmin(Boolean(me.user.permissions?.editAreas ?? me.user.isAdmin ?? me.user.role === "admin"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to load ${AREA.plural.toLowerCase()}`);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(area: AreaRow) {
    setEditing(area);
    setForm({
      name: area.name,
      description: area.description ?? "",
      sortOrder: String(area.sortOrder),
    });
    setDialogOpen(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    const sortParsed = Number(form.sortOrder);
    const sortOrder = Number.isFinite(sortParsed) ? Math.trunc(sortParsed) : 0;
    const description = form.description.trim();

    setBusy(true);
    try {
      if (editing) {
        await api.updateRoom(editing.id, {
          name,
          description: description || null,
          sortOrder,
        });
      } else {
        await api.createRoom({
          name,
          description: description || undefined,
          sortOrder,
        });
      }
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
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
      await api.deleteRoom(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4">{AREA.plural}</Typography>
        {isAdmin && (
          <Button variant="contained" onClick={openCreate}>
            {AREA.add}
          </Button>
        )}
      </Stack>
      <Typography color="text.secondary">{AREA.description}</Typography>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent sx={{ px: { xs: 1, sm: 2 }, "&:last-child": { pb: 2 } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Devices</TableCell>
                <TableCell align="right">Sort</TableCell>
                {isAdmin && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {areas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4}>
                    <Typography color="text.secondary">
                      No {AREA.plural.toLowerCase()} yet.
                      {isAdmin ? ` Use “${AREA.add}” to create one.` : ""}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                areas.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.description ?? "—"}</TableCell>
                    <TableCell align="right">{a.deviceCount}</TableCell>
                    <TableCell align="right">{a.sortOrder}</TableCell>
                    {isAdmin && (
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={AREA.edit}
                          onClick={() => openEdit(a)}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={AREA.delete}
                          color="error"
                          onClick={() => setDeleteTarget(a)}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => !busy && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={(e) => void onSave(e)}>
          <DialogTitle>{editing ? AREA.edit : AREA.add}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                fullWidth
                autoFocus
                placeholder="e.g. Kitchen, Front Garden, Driveway"
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                fullWidth
                multiline
                minRows={2}
              />
              <TextField
                label="Sort order"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
                fullWidth
                helperText="Lower numbers appear first"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={busy}>
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
        <DialogTitle>{AREA.delete}</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteTarget?.name}</strong>? Devices in this{" "}
            {AREA.singular.toLowerCase()} keep working and become unassigned.
          </Typography>
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
    </Stack>
  );
}
