import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import { api, clearStoredTokens } from "../api";
import { useSkin } from "../skins/SkinProvider";
import { ButtonRow } from "../components/ButtonRow";

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applyAccountPrefs } = useSkin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.login(username.trim(), password);
      applyAccountPrefs(data.user.themePrefs);
      // Back to the page that asked for signing in (only addresses inside Nexternel).
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/login") ? from : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function clearSavedLogin() {
    clearStoredTokens();
    setCleared(true);
    setError(null);
  }

  return (
    <Paper sx={{ p: 3, maxWidth: 420, mx: "auto" }}>
      <ButtonRow component="form" onSubmit={onSubmit}>
        <Typography variant="h5">Sign in</Typography>
        <Typography variant="body2" color="text.secondary">
          Sign in with your username and password.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {cleared && (
          <Alert severity="success">Saved login cleared — sign in again.</Alert>
        )}
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          fullWidth
          disabled={busy}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          disabled={busy}
        />
        <Button type="submit" variant="contained" disabled={busy} fullWidth>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <Button type="button" onClick={clearSavedLogin} disabled={busy} fullWidth>
          Forget saved sign-in
        </Button>
      </ButtonRow>
    </Paper>
  );
}
