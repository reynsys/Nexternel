import { PageActions } from "../../components/PageHeader";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { api, type RoleDef } from "../../api";
import { useConfirm } from "../../components/confirm";
import {
  ALL_PERMISSIONS_ON,
  PERMISSION_META,
  VIEWER_PERMISSIONS,
  normalizePermissions,
  type RolePermissions,
} from "../../lib/permissions";
import { ButtonRow } from "../../components/ButtonRow";
import { useLiveChanges } from "../../lib/live-changes";

function PermissionEditor({
  value,
  onChange,
  lockAdminCore,
}: {
  value: RolePermissions;
  onChange: (next: RolePermissions) => void;
  /** System admin: keep manageUsers + manageRoles on */
  lockAdminCore?: boolean;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof PERMISSION_META>();
    for (const m of PERMISSION_META) {
      const list = map.get(m.group) ?? [];
      list.push(m);
      map.set(m.group, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <Stack spacing={2}>
      <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onChange({ ...ALL_PERMISSIONS_ON })}
        >
          Full access
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => onChange({ ...VIEWER_PERMISSIONS })}
        >
          View only
        </Button>
      </ButtonRow>
      {groups.map(([group, items]) => (
        <Box key={group}>
          <Typography variant="subtitle2" gutterBottom>
            {group}
          </Typography>
          <FormGroup>
            {items.map((m) => {
              const locked =
                lockAdminCore &&
                (m.key === "manageUsers" || m.key === "manageRoles");
              return (
                <FormControlLabel
                  key={m.key}
                  control={
                    <Checkbox
                      checked={value[m.key]}
                      disabled={locked}
                      onChange={(_, checked) =>
                        onChange({ ...value, [m.key]: checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">{m.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.help}
                      </Typography>
                    </Box>
                  }
                />
              );
            })}
          </FormGroup>
          <Divider sx={{ mt: 1 }} />
        </Box>
      ))}
    </Stack>
  );
}

export function RolesPage() {
  const { confirm } = useConfirm();
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDef | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<RolePermissions>({
    ...VIEWER_PERMISSIONS,
  });
  const [busy, setBusy] = useState(false);

  // Changes made on another screen show here straight away.
  useLiveChanges(["roles"], () => void load());
  async function load() {
    try {
      const res = await api.roles();
      setRoles(res.roles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAdd() {
    setName("");
    setDescription("");
    setPermissions({ ...VIEWER_PERMISSIONS });
    setAddOpen(true);
  }

  function openEdit(r: RoleDef) {
    setEditRole(r);
    setName(r.name);
    setDescription(r.description ?? "");
    setPermissions(normalizePermissions(r.permissions ?? VIEWER_PERMISSIONS));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createRole({
        // The short name Nexternel uses inside is made from the role name (never shown).
        slug: roleSlugFromName(name),
        name: name.trim(),
        description: description.trim() || null,
        permissions,
      });
      setAddOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editRole) return;
    setBusy(true);
    try {
      await api.patchRole(editRole.id, {
        name: name.trim(),
        description: description.trim() || null,
        permissions,
      });
      setEditRole(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(r: RoleDef) {
    if (r.isSystem) return;
    const ok = await confirm({
      title: "Delete role?",
      message: `Delete role “${r.name}”? Users must be reassigned first.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await api.deleteRole(r.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function enabledCount(r: RoleDef): number {
    const p = normalizePermissions(r.permissions);
    return Object.values(p).filter(Boolean).length;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Button component={RouterLink} to="/admin/settings/users" variant="outlined" startIcon={<ArrowBackRoundedIcon />}>
            Users
          </Button>
          <Typography variant="h5">Roles</Typography>
        </Stack>
      </Stack>
      <PageActions>
        <Button startIcon={<AddIcon />} variant="contained" onClick={openAdd}>
          Add role
        </Button>
      </PageActions>
      <Typography variant="body2" color="text.secondary">
        Set what each role can view or change. A person's role is chosen on the Users page.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent sx={{ px: { xs: 1, sm: 2 }, "&:last-child": { pb: 2 } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Permissions</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2">{r.name}</Typography>
                      {r.isSystem && <Chip size="small" label="System" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={`${enabledCount(r)} enabled`}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{r.description ?? "—"}</TableCell>
                  <TableCell align="right"><ButtonRow justifyContent="flex-end" flexWrap="nowrap">
                    <Button size="small" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    {!r.isSystem && (
                      <Button startIcon={<DeleteOutlineIcon />} size="small" color="error" onClick={() => void onDelete(r)}>
                        Delete
                      </Button>
                    )}
                  </ButtonRow></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="md">
        <form onSubmit={onCreate}>
          <DialogTitle>Add role</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Typography variant="subtitle1">Permissions</Typography>
              <PermissionEditor value={permissions} onChange={setPermissions} />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              Add role
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editRole)}
        onClose={() => setEditRole(null)}
        fullWidth
        maxWidth="md"
      >
        <form onSubmit={onSaveEdit}>
          <DialogTitle>
            Edit role{editRole ? ` — ${editRole.name}` : ""}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Typography variant="subtitle1">Permissions</Typography>
              <Typography variant="body2" color="text.secondary">
                Choose what this role is allowed to do. Disabled items are hidden from the
                menu.
              </Typography>
              <PermissionEditor
                value={permissions}
                onChange={setPermissions}
                lockAdminCore={editRole?.isSystem && editRole.slug === "admin"}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditRole(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}

/** A role's inside name from what people call it: "Guest room" → "guest-room" (starts with a letter). */
function roleSlugFromName(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return /^[a-z]/.test(base) ? base : `role-${base || "new"}`;
}
