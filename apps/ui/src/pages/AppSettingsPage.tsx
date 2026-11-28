import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { PageHeader } from "../components/PageHeader";
import { ButtonRow } from "../components/ButtonRow";
import { useAppUpdate, type AppBridge } from "../components/AppFrame";
import { useContentSurfaceSx } from "../skins/useSurfaceStyles";

/**
 * App settings: everything the App on this phone or tablet controls (Nexternel's own settings are
 * in Settings). Kept on this phone or tablet only. Change home is last, away from Check for update.
 */
export function AppSettingsPage() {
  const surfaceSx = useContentSurfaceSx();
  const { bridge, state, busy, check } = useAppUpdate();
  const navigate = useNavigate();
  // Came from another Nexternel page: go back to it; opened straight in: the start dashboard.
  const goBack = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate("/"));
  if (!bridge) return <Navigate to="/" replace />;

  const latest = state.latest ?? null;
  // One line that is always there and only changes its words, so nothing below jumps while checking.
  const note = busy
    ? "Checking…"
    : latest
      ? `Version ${latest} is ready.`
      : state.checked
        ? state.failed
          ? "Could not check. Check the internet connection."
          : "Up to date."
        : "\u00a0";

  return (
    <Stack spacing={3}>
      {/* A page with no place in the main menu needs its own way out: back to where you came from. */}
      <Box>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={goBack}>
          Back
        </Button>
      </Box>
      <PageHeader title="App settings" />

      <Card sx={surfaceSx}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6">App</Typography>
            <Typography variant="body2" color="text.secondary">
              Nexternel for Android {state.current ?? ""}
            </Typography>
            <ButtonRow direction="row">
              {latest ? (
                <Button variant="contained" onClick={() => bridge.installUpdate()}>
                  Update to {latest}
                </Button>
              ) : (
                <Button variant="outlined" disabled={busy} onClick={check}>
                  Check for update
                </Button>
              )}
            </ButtonRow>
            <Typography variant="body2" color="text.secondary" aria-live="polite">
              {note}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <KeepScreenOn bridge={bridge} surfaceSx={surfaceSx} />

      {typeof bridge.changeHome === "function" ? <HomeCard bridge={bridge} surfaceSx={surfaceSx} /> : null}
    </Stack>
  );
}

/** For a tablet used as a room's screen: kept awake only while Nexternel is open (App 1.0.5 or newer). */
function KeepScreenOn({ bridge, surfaceSx }: { bridge: AppBridge; surfaceSx: object }) {
  const [on, setOn] = useState(() => {
    try {
      return bridge.keepScreenOn?.() === true;
    } catch {
      return false;
    }
  });
  if (typeof bridge.keepScreenOn !== "function" || typeof bridge.setKeepScreenOn !== "function") return null;
  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="h6">Screen</Typography>
          <FormControlLabel
            sx={{ mr: 0 }}
            control={
              <Switch
                checked={on}
                onChange={(e) => {
                  setOn(e.target.checked);
                  bridge.setKeepScreenOn?.(e.target.checked);
                }}
              />
            }
            label="Keep the screen on while Nexternel is open"
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

/** The home this app opens, and Change home (asks first, so it is not pressed by mistake). */
function HomeCard({ bridge, surfaceSx }: { bridge: AppBridge; surfaceSx: object }) {
  const [asking, setAsking] = useState(false);
  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack spacing={1.5}>
          <Typography variant="h6">Address</Typography>
          <Paper variant="inset" sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25, minWidth: 0 }}>
            <HomeOutlinedIcon aria-hidden sx={{ color: "primary.main", flexShrink: 0 }} />
            <Typography variant="body1" sx={{ fontWeight: "fontWeightMedium", overflowWrap: "anywhere" }}>
              {window.location.host}
            </Typography>
          </Paper>
          <ButtonRow direction="row">
            <Button variant="outlined" onClick={() => setAsking(true)}>
              Change address
            </Button>
          </ButtonRow>
        </Stack>
      </CardContent>
      <Dialog open={asking} onClose={() => setAsking(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change address?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Nexternel and its settings stay as they are.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAsking(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setAsking(false);
              bridge.changeHome?.();
            }}
          >
            Change address
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
