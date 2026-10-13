import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  api,
  type AdminUser,
  type RoleDef,
  type UserThemePrefs,
} from "../../api";
import { UserAvatarField } from "../../components/UserAvatarField";
import { notifyUserUpdated } from "../../lib/user-events";
import { userInitial } from "../../lib/user-display";
import { listSkins } from "../../skins/registry";
import { ThemeOptionsFields } from "../../skins/ThemeOptionsFields";
import {
  DEFAULT_THEME_PREFS,
  normalizeThemePrefs,
  type ThemePrefs,
} from "../../skins/themePrefs";
import { useShellAuth } from "../../skins/useShellAuth";
import { useContentSurfaceSx } from "../../skins/useSurfaceStyles";
import { ProfileSection } from "./sections/ProfileSection";

function prefsFromUser(u: AdminUser | null): { theme: ThemePrefs; skinId: string } {
  const n = normalizeThemePrefs(u?.themePrefs ?? DEFAULT_THEME_PREFS);
  return {
    theme: n,
    skinId: u?.themePrefs?.skinId ?? n.skinId ?? "mui-dashboard",
  };
}

export function UsersPage() {
  const { user: me } = useShellAuth();
  const surfaceSx = useContentSurfaceSx();
  const skins = listSkins();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("viewer");
  const [isActive, setIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePrefs>(DEFAULT_THEME_PREFS);
  const [skinId, setSkinId] = useState("mui-dashboard");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [usersRes, rolesRes] = await Promise.all([api.users(), api.roles()]);
      setUsers(usersRes.users);
      setRoles(rolesRes.roles);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openAdd() {
    setUsername("");
    setPassword("");
    setDisplayName("");
    setRole(roles.find((r) => r.slug === "viewer")?.slug ?? roles[0]?.slug ?? "viewer");
    setAvatarData(null);
    setTheme({ ...DEFAULT_THEME_PREFS });
    setSkinId(DEFAULT_THEME_PREFS.skinId ?? "mui-dashboard");
    setAddOpen(true);
  }

  function openEdit(u: AdminUser) {
    setEditUser(u);
    setDisplayName(u.displayName ?? "");
    setRole(u.role);
    setIsActive(u.isActive);
    setEditPassword("");
    setAvatarData(u.avatarData ?? null);
    const p = prefsFromUser(u);
    setTheme(p.theme);
    setSkinId(p.skinId);
  }

  function themePayload(): UserThemePrefs {
    return {
      mode: theme.mode,
      primary: theme.primary,
      skinId,
      gradientId: theme.gradientId,
      solidContentPanels: theme.solidContentPanels,
      effectId: theme.effectId,
      effectAmount: theme.effectAmount,
      effectSpeed: theme.effectSpeed,
      effectColour: theme.effectColour,
      statusLight: theme.statusLight,
    };
  }

  function maybeRefreshShell(userId: string) {
    if (me?.id === userId) notifyUserUpdated();
  }

  function roleName(slug: string): string {
    return roles.find((r) => r.slug === slug)?.name ?? slug;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createUser({
        username: username.trim(),
        password,
        displayName: displayName.trim() || undefined,
        role,
        themePrefs: themePayload(),
        avatarData,
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
    if (!editUser) return;
    setBusy(true);
    try {
      await api.patchUser(editUser.id, {
        displayName: displayName.trim() || null,
        role,
        isActive,
        themePrefs: themePayload(),
        avatarData,
        ...(editPassword.trim() ? { password: editPassword.trim() } : {}),
      });
      maybeRefreshShell(editUser.id);
      setEditUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: AdminUser) {
    try {
      await api.patchUser(u.id, { isActive: !u.isActive });
      maybeRefreshShell(u.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function setUserRole(u: AdminUser, next: string) {
    if (u.role === next) return;
    try {
      await api.patchUser(u.id, { role: next });
      maybeRefreshShell(u.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role update failed");
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
        <Typography variant="h4">Users</Typography>
        <Stack direction="row" spacing={1}>
          <Button component={RouterLink} to="/admin/roles" variant="outlined">
            Edit roles
          </Button>
          <Button variant="contained" onClick={openAdd}>
            Add user
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Manage accounts and assign roles. Manage what each role can do under{" "}
        <Button component={RouterLink} to="/admin/roles" size="small" sx={{ px: 0.5 }}>
          Roles
        </Button>
        .
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <ProfileSection />
      <Card sx={surfaceSx}>
        <CardContent sx={{ px: { xs: 1, sm: 2 }, "&:last-child": { pb: 2 } }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Display name</TableCell>
                <TableCell sx={{ minWidth: 200 }}>Role</TableCell>
                <TableCell>Theme</TableCell>
                <TableCell>Active</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Avatar
                        src={u.avatarData ?? undefined}
                        sx={{ width: 32, height: 32, bgcolor: "primary.dark" }}
                      >
                        {userInitial(u)}
                      </Avatar>
                      <Typography variant="body2">{u.username}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{u.displayName ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      fullWidth
                      value={u.role}
                      aria-label={`Role for ${u.username}`}
                      onChange={(e) => void setUserRole(u, e.target.value)}
                    >
                      {roles.map((r) => (
                        <MenuItem key={r.id} value={r.slug}>
                          {r.name}
                          {r.isAdmin ? " (admin)" : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    {u.themePrefs
                      ? `${u.themePrefs.mode} · ${u.themePrefs.primary}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Switch checked={u.isActive} onChange={() => void toggleActive(u)} />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={onCreate}>
          <DialogTitle>Add user</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <UserAvatarField
                avatarData={avatarData}
                displayName={displayName}
                username={username}
                onChange={setAvatarData}
              />
              <TextField
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                helperText="At least 6 characters"
              />
              <TextField
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
                helperText="Shown in the side menu instead of the username"
              />
              <FormControl fullWidth>
                <InputLabel id="add-role">Role</InputLabel>
                <Select
                  labelId="add-role"
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <MenuItem key={r.id} value={r.slug}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Divider />
              <Typography variant="subtitle1">Default theme</Typography>
              <ThemeOptionsFields
                themePrefs={theme}
                skinId={skinId}
                skins={skins}
                onThemeChange={setTheme}
                onSkinChange={setSkinId}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              Create
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={onSaveEdit}>
          <DialogTitle>
            Edit user{editUser ? ` — ${editUser.username}` : ""}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <UserAvatarField
                avatarData={avatarData}
                displayName={displayName}
                username={editUser?.username}
                onChange={setAvatarData}
              />
              <TextField
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                fullWidth
                helperText="Shown in the side menu"
              />
              <FormControl fullWidth>
                <InputLabel id="edit-role">Role</InputLabel>
                <Select
                  labelId="edit-role"
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <MenuItem key={r.id} value={r.slug}>
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                Current role: {editUser ? roleName(editUser.role) : ""}
              </Typography>
              <TextField
                label="New password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                fullWidth
                helperText="Leave blank to keep the current password"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={isActive}
                    onChange={(_, checked) => setIsActive(checked)}
                  />
                }
                label="Account active"
              />
              <Divider />
              <Typography variant="subtitle1">Default theme</Typography>
              <ThemeOptionsFields
                themePrefs={theme}
                skinId={skinId}
                skins={skins}
                onThemeChange={setTheme}
                onSkinChange={setSkinId}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditUser(null)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={busy}>
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Stack>
  );
}
