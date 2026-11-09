import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../api";
import { UserAvatarField } from "../../../components/UserAvatarField";
import { notifyUserUpdated } from "../../../lib/user-events";
import { roleLabel } from "../../../lib/user-display";
import { useShellAuth } from "../../../skins/useShellAuth";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

export function ProfileSection() {
  const surfaceSx = useContentSurfaceSx();
  const { user } = useShellAuth();
  const [displayName, setDisplayName] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [elsewhereBusy, setElsewhereBusy] = useState(false);
  const [elsewhereMsg, setElsewhereMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSignOutElsewhere() {
    setElsewhereBusy(true);
    setElsewhereMsg(null);
    try {
      await api.signOutElsewhere();
      setElsewhereMsg({ ok: true, text: "Done. Every other screen signed in as you has to sign in again." });
    } catch (error) {
      setElsewhereMsg({ ok: false, text: error instanceof Error ? error.message : "Could not sign out elsewhere" });
    } finally {
      setElsewhereBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setAvatarData(user.avatarData ?? null);
    setEmail(user.email ?? "");
  }, [user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    if (newPassword && newPassword !== repeatPassword) {
      setErr("The two new passwords are not the same.");
      setBusy(false);
      return;
    }
    try {
      await api.patchMe({
        displayName: displayName.trim() || null,
        avatarData,
        email: email.trim() || null,
        ...(newPassword ? { password: newPassword } : {}),
      });
      notifyUserUpdated();
      setMsg(newPassword ? "Profile and new password saved. Other screens signed in as you have to sign in again." : "Profile saved.");
      setNewPassword("");
      setRepeatPassword("");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          My profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Username <strong>{user.username}</strong> · {roleLabel(user.role, user.roleName)}.
          An administrator can change your role in the list of users below.
        </Typography>
        <Stack component="form" spacing={2} onSubmit={(e) => void onSave(e)}>
          <UserAvatarField
            avatarData={avatarData}
            displayName={displayName}
            username={user.username}
            onChange={setAvatarData}
          />
          <TextField
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            helperText="Shown next to your name in the side menu"
          />
          <TextField
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            helperText="For warnings and the unlock link, if your account gets locked from outside"
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            helperText="Leave blank to keep your password. At least 12 characters; a few words in a row are easy to remember."
          />
          {newPassword && (
            <TextField
              label="New password again"
              type="password"
              autoComplete="new-password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              fullWidth
            />
          )}
          {err && <Alert severity="error">{err}</Alert>}
          {msg && <Alert severity="success">{msg}</Alert>}
          <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: "flex-start" }}>
            Save profile
          </Button>
        </Stack>
        <Typography variant="subtitle1" sx={{ mt: 4, mb: 0.5 }}>
          Sign out everywhere else
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Lost a phone, or signed in on someone else's screen? This signs you out on every other
          screen. This one stays signed in. Wall screens signed in as you will need to sign in again.
          Changing your password does this too.
        </Typography>
        {elsewhereMsg && (
          <Alert severity={elsewhereMsg.ok ? "success" : "error"} sx={{ mb: 1.5 }}>
            {elsewhereMsg.text}
          </Alert>
        )}
        <Button variant="outlined" disabled={elsewhereBusy} onClick={() => void onSignOutElsewhere()}>
          Sign out everywhere else
        </Button>
      </CardContent>
    </Card>
  );
}
