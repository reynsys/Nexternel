import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { api, clearStoredTokens } from "../api";
import { useSkin } from "../skins/SkinProvider";
import { isGradientActive } from "../skins/surfaceStyles";
import { ButtonRow } from "../components/ButtonRow";
import { BrandMark } from "../components/BrandMark";
import { APP_VERSION } from "../version";

/** Faint rings behind the welcome side, tilted like the logo's ring. */
const RINGS = [
  { w: 1300, h: 440, a: 0.1, b: 1 },
  { w: 900, h: 300, a: 0.18, b: 1 },
  { w: 560, h: 190, a: 0.24, b: 2 },
];

/**
 * The sign-in screen: a welcome side and the sign-in box, side by side (stacked on a phone).
 * The welcome side shows this device's Appearance — its background and effect, drawn page-wide by
 * SkinProvider — or, with none chosen, a calm tint of the main colour. The sign-in box is always
 * solid, so a busy background never makes it hard to read.
 */
export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { applyAccountPrefs, themePrefs } = useSkin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keep, setKeep] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleared, setCleared] = useState(false);
  const backdrop = isGradientActive(themePrefs);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.login(username.trim(), password, keep);
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

  // Text over a background picture or effect gets a soft shadow so it stays readable.
  const overBackdrop = (t: Theme) =>
    t.palette.mode === "dark" ? "0 1px 14px rgba(0, 0, 0, 0.55)" : "0 1px 12px rgba(255, 255, 255, 0.7)";

  return (
    <Box sx={{ minHeight: ["100vh", "100dvh"], display: "flex", flexWrap: "wrap" }}>
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          flex: "1 1 520px",
          minHeight: { xs: 220, md: "auto" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 3,
          p: { xs: 3, md: 6 },
          boxSizing: "border-box",
          bgcolor: (t) => (backdrop ? "transparent" : t.nxScheme.main.soft),
          color: "text.primary",
          textShadow: (t) => (backdrop ? overBackdrop(t) : "none"),
        }}
      >
        {RINGS.map((r) => (
          <Box
            key={r.w}
            aria-hidden
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: r.w,
              height: r.h,
              ml: `${-r.w / 2}px`,
              mt: `${-r.h / 2}px`,
              border: (t) => `${r.b}px solid ${alpha(t.nxScheme.main.solid, r.a)}`,
              borderRadius: "50%",
              transform: "rotate(-20deg)",
              pointerEvents: "none",
            }}
          />
        ))}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ position: "relative" }}>
          <BrandMark size={40} />
          <Typography variant="h5" component="div">
            Nexternel
          </Typography>
        </Stack>
        <Box sx={{ position: "relative", display: { xs: "none", md: "flex" }, justifyContent: "center" }}>
          <BrandMark size={240} />
        </Box>
        <Stack spacing={1.25} sx={{ position: "relative", maxWidth: 480 }}>
          <Typography variant="h3" component="p" sx={{ fontWeight: "fontWeightBold" }}>
            Your home,
            <br />
            in one place.
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Lights, climate, energy and every board in the house — on your own server, under your control.
          </Typography>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: "1 1 420px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: { xs: 4, md: 6 },
          boxSizing: "border-box",
          bgcolor: (t) => t.nxScheme.surfaceSolid.frame,
          borderLeft: (t) => ({ md: `1px solid ${t.nxScheme.line.edge}` }),
        }}
      >
        <Stack component="form" onSubmit={onSubmit} spacing={2.25} sx={{ width: "100%", maxWidth: 380 }}>
          <Stack spacing={0.75}>
            <Typography variant="h4" component="h1">
              Welcome home
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to continue.
            </Typography>
          </Stack>
          {error && <Alert severity="error">{error}</Alert>}
          {cleared && <Alert severity="success">Saved sign-in forgotten — sign in again.</Alert>}
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            fullWidth
            disabled={busy}
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
            disabled={busy}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <FormControlLabel
            control={<Checkbox checked={keep} onChange={(e) => setKeep(e.target.checked)} disabled={busy} />}
            label="Keep me signed in on this device"
          />
          <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <ButtonRow justifyContent="space-between" sx={{ pt: 1.5, borderTop: (t) => `1px solid ${t.nxScheme.line.divider}` }}>
            <Typography variant="caption" color="text.secondary">
              Nexternel {APP_VERSION}
            </Typography>
            <Button type="button" size="small" onClick={clearSavedLogin} disabled={busy}>
              Forget saved sign-in
            </Button>
          </ButtonRow>
        </Stack>
      </Box>
    </Box>
  );
}
