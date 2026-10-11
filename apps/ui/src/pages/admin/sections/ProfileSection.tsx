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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setAvatarData(user.avatarData ?? null);
  }, [user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      await api.patchMe({
        displayName: displayName.trim() || null,
        avatarData,
      });
      notifyUserUpdated();
      setMsg("Profile saved.");
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
          An administrator can change your role in the table below.
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
          {err && <Alert severity="error">{err}</Alert>}
          {msg && <Alert severity="success">{msg}</Alert>}
          <Button type="submit" variant="contained" disabled={busy} sx={{ alignSelf: "flex-start" }}>
            Save profile
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
