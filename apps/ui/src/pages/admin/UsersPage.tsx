import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
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
  Paper,
  Stack,
  Switch,
  Tab,
  Table,
  TableBody,
  Box,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
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
  toAccountThemePrefs,
  type ThemePrefs,
} from "../../skins/themePrefs";
import { useShellAuth } from "../../skins/useShellAuth";
import { useContentSurfaceSx } from "../../skins/useSurfaceStyles";
import { ProfileSection } from "./sections/ProfileSection";
import { SecondCheckSection } from "./sections/SecondCheckSection";
import { hasPermission } from "../../lib/permissions";
import { ButtonRow } from "../../components/ButtonRow";
import { useLiveChanges } from "../../lib/live-changes";
import { WallDisplayFields } from "../../components/WallDisplayFields";
import { BellFields } from "../../components/BellFields";

function prefsFromUser(u: AdminUser | null): { theme: ThemePrefs; skinId: string } {
  const n = normalizeThemePrefs(u?.themePrefs ?? DEFAULT_THEME_PREFS);
  return {
    theme: n,
    skinId: u?.themePrefs?.skinId ?? n.skinId ?? "mui-dashboard",
  };
}

/**
 * Settings → Users. Administrators see everyone; every other account sees only My profile and
 * Second check here (their own name, email, password and sign-in safety).
 */
export function UsersPage() {
  const { user: me } = useShellAuth();
  if (!me) return null;
  if (!hasPermission(me.permissions ?? null, "manageUsers", Boolean(me.isAdmin))) {
    return (
      <Stack spacing={2}>
        <ProfileSection />
        <SecondCheckSection />
      </Stack>
    );
  }
  return <UsersAdminPage />;
}

function UsersAdminPage() {
  const { user: me } = useShellAuth();
  const surfaceSx = useContentSurfaceSx();
  const skins = listSkins();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editTab, setEditTab] = useState<"account" | "appearance" | "wall" | "bell">("account");
  const muiTheme = useTheme();
  const phoneDialog = useMediaQuery(muiTheme.breakpoints.down("sm"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("viewer");
  const [isActive, setIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [email, setEmail] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePrefs>(DEFAULT_THEME_PREFS);
  const [skinId, setSkinId] = useState("mui-dashboard");
  const [busy, setBusy] = useState(false);

  // Changes made on another screen show here straight away.
  useLiveChanges(["users", "roles"], () => void load());
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
    setEmail("");
    setRole(roles.find((r) => r.slug === "viewer")?.slug ?? roles[0]?.slug ?? "viewer");
    setAvatarData(null);
    setTheme({ ...DEFAULT_THEME_PREFS });
    setSkinId(DEFAULT_THEME_PREFS.skinId ?? "mui-dashboard");
    setAddOpen(true);
  }

  function openEdit(u: AdminUser) {
    setEditUser(u);
    setEditTab("account");
    setDisplayName(u.displayName ?? "");
    setRole(u.role);
    setIsActive(u.isActive);
    setEditPassword("");
    setEmail(u.email ?? "");
    setAvatarData(u.avatarData ?? null);
    const p = prefsFromUser(u);
    setTheme(p.theme);
    setSkinId(p.skinId);
  }

  /** Every Appearance choice of the person being edited (the same set Appearance saves). */
  function themePayload(): UserThemePrefs {
    return toAccountThemePrefs(theme, skinId);
  }

  function maybeRefreshShell(userId: string) {
    if (me?.id === userId) notifyUserUpdated();
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
        email: email.trim() || null,
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
        email: email.trim() || null,
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

  async function secondCheckOff(u: AdminUser) {
    try {
      await api.userSecondCheckOff(u.id);
      setEditUser({ ...u, secondCheck: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn the second check off");
    }
  }

  async function unlock(u: AdminUser) {
    try {
      await api.unlockOutside(u.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
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
      {/* The page title and its one-line hint come from Settings. */}
      <Stack direction="row" justifyContent="flex-end" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
        <ButtonRow direction="row">
          <Button component={RouterLink} to="/admin/settings/users/roles" variant="outlined">
            Roles
          </Button>
          <Button variant="contained" onClick={openAdd}>
            Add user
          </Button>
        </ButtonRow>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <ProfileSection />
      <SecondCheckSection />
      <Card sx={surfaceSx}>
        <CardContent sx={{ px: { xs: 1, sm: 2 }, "&:last-child": { pb: 2 } }}>
          {/* Phones: one card per person instead of the table (which ran off the screen). */}
          <Stack spacing={1.5} sx={{ display: { xs: "flex", sm: "none" } }}>
            {users.map((u) => (
              <Paper key={u.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                  <Avatar src={u.avatarData ?? undefined} sx={{ width: 36, height: 36 }}>
                    {userInitial(u)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: "fontWeightBold" }} noWrap>
                      {u.displayName ?? u.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {u.username}
                    </Typography>
                  </Box>
                  <Switch checked={u.isActive} inputProps={{ "aria-label": `${u.username} can sign in` }} onChange={() => void toggleActive(u)} />
                </Stack>
                {u.lockedOutside || u.secondCheck ? (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }} useFlexGap>
                    {u.lockedOutside && <Chip size="small" color="error" variant="outlined" label="Locked from outside" />}
                    {u.secondCheck && <Chip size="small" color="success" variant="outlined" label="Second check on" />}
                  </Stack>
                ) : null}
                <Select
                  size="small"
                  fullWidth
                  value={u.role}
                  aria-label={`Role for ${u.username}`}
                  onChange={(e) => void setUserRole(u, e.target.value)}
                  sx={{ mt: 1.5 }}
                >
                  {roles.map((r) => (
                    <MenuItem key={r.id} value={r.slug}>
                      {r.name}
                      {r.isAdmin ? " (admin)" : ""}
                    </MenuItem>
                  ))}
                </Select>
                <ButtonRow direction="row" sx={{ mt: 1.5, justifyContent: "flex-end" }}>
                  {u.lockedOutside && (
                    <Button size="small" color="error" variant="outlined" onClick={() => void unlock(u)}>
                      Unlock
                    </Button>
                  )}
                  <Button size="small" variant="outlined" onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                </ButtonRow>
              </Paper>
            ))}
          </Stack>
          <Table size="small" sx={{ display: { xs: "none", sm: "table" } }}>
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
                        sx={{ width: 32, height: 32 }}
                      >
                        {userInitial(u)}
                      </Avatar>
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Typography variant="body2">{u.username}</Typography>
                        {u.lockedOutside && (
                          <Chip size="small" color="error" variant="outlined" label="Locked from outside" />
                        )}
                        {u.secondCheck && <Chip size="small" color="success" variant="outlined" label="Second check on" />}
                      </Stack>
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
                    <ButtonRow direction="row" sx={{ justifyContent: "flex-end" }}>
                      {u.lockedOutside && (
                        <Button size="small" color="error" variant="outlined" onClick={() => void unlock(u)}>
                          Unlock
                        </Button>
                      )}
                      <Button size="small" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                    </ButtonRow>
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
                helperText="At least 12 characters. A few words in a row are easy to remember."
              />
              <TextField
                label="Email (optional)"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                helperText="For warnings and the unlock link, if this account gets locked from outside"
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
              <Divider />
              <Typography variant="subtitle1">Wall display</Typography>
              <WallDisplayFields value={theme.wall} onChange={(wall) => setTheme((t) => ({ ...t, wall }))} />
              <Typography variant="subtitle1">Notification bell</Typography>
              <BellFields value={theme.bell} onChange={(bell) => setTheme((t) => ({ ...t, bell }))} />
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
        maxWidth="lg"
        fullScreen={phoneDialog}
        PaperProps={{ sx: phoneDialog ? undefined : { height: "min(920px, calc(100% - 64px))" } }}
      >
        <form onSubmit={onSaveEdit} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          <DialogTitle sx={{ pb: 0 }}>
            Edit user{editUser ? ` — ${editUser.username}` : ""}
          </DialogTitle>
          <Tabs
            value={editTab}
            onChange={(_, v) => setEditTab(v)}
            variant="scrollable"
            allowScrollButtonsMobile
            aria-label="Edit user"
            sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}
          >
            <Tab value="account" label="Account" />
            <Tab value="appearance" label="Appearance" />
            <Tab value="wall" label="Wall display" />
            <Tab value="bell" label="Notification bell" />
          </Tabs>
          <DialogContent sx={{ flex: 1, minHeight: 0 }}>
            {editTab === "account" ? (
              <Stack spacing={2} sx={{ mt: 1, maxWidth: 560 }}>
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
                  <Select labelId="edit-role" label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                    {roles.map((r) => (
                      <MenuItem key={r.id} value={r.slug}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="New password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  fullWidth
                  helperText="Leave blank to keep the current password. At least 12 characters."
                />
                <TextField
                  label="Email (optional)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  helperText="For warnings and the unlock link, if this account gets locked from outside"
                />
                <FormControlLabel
                  control={<Switch checked={isActive} onChange={(_, checked) => setIsActive(checked)} />}
                  label="Account active"
                />
                {editUser?.secondCheck && (
                  <Stack spacing={0.5}>
                    <Button variant="outlined" color="error" onClick={() => void secondCheckOff(editUser)} sx={{ alignSelf: "flex-start" }}>
                      Turn off second check
                    </Button>
                    <Typography variant="caption" color="text.secondary">
                      For someone who lost their phone. They can then sign in from outside with a strong password, and set it up again.
                    </Typography>
                  </Stack>
                )}
              </Stack>
            ) : null}
            {editTab === "appearance" ? (
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  How Nexternel looks for this account. They can also change it themselves in Appearance.
                </Typography>
                <ThemeOptionsFields
                  themePrefs={theme}
                  skinId={skinId}
                  skins={skins}
                  onThemeChange={setTheme}
                  onSkinChange={setSkinId}
                />
              </Stack>
            ) : null}
            {editTab === "wall" ? (
              <Stack sx={{ mt: 1, maxWidth: 640 }}>
                <WallDisplayFields value={theme.wall} onChange={(wall) => setTheme((t) => ({ ...t, wall }))} />
              </Stack>
            ) : null}
            {editTab === "bell" ? (
              <Stack sx={{ mt: 1, maxWidth: 640 }}>
                <BellFields value={theme.bell} onChange={(bell) => setTheme((t) => ({ ...t, bell }))} />
              </Stack>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ borderTop: 1, borderColor: "divider" }}>
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
