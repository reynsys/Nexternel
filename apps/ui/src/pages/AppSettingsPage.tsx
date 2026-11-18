import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
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
  if (!bridge) return <Navigate to="/" replace />;

  const latest = state.latest ?? null;
  let note: string | null = null;
  if (!busy && state.checked && !latest) note = state.failed ? "Could not check. Check the internet connection." : "This is the newest version.";

  return (
    <Stack spacing={3}>
      <PageHeader title="App settings" hint="Settings for the app on this phone or tablet. Nexternel's own settings are in Settings." />

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
                  {busy ? "Checking…" : "Check for update"}
                </Button>
              )}
            </ButtonRow>
            {note ? (
              <Typography variant="body2" color="text.secondary">
                {note}
              </Typography>
            ) : null}
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
          <Typography variant="body2" color="text.secondary">
            When Nexternel is closed or in the background, the screen sleeps as usual.
          </Typography>
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
          <Typography variant="h6">Home address</Typography>
          <Typography variant="body2" color="text.secondary">
            This app opens your Nexternel here.
          </Typography>
          <Paper variant="inset" sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1.5, py: 1.25, minWidth: 0 }}>
            <HomeOutlinedIcon aria-hidden sx={{ color: "primary.main", flexShrink: 0 }} />
            <Typography variant="body1" sx={{ fontWeight: "fontWeightMedium", overflowWrap: "anywhere" }}>
              {window.location.host}
            </Typography>
          </Paper>
          <ButtonRow direction="row">
            <Button variant="outlined" onClick={() => setAsking(true)}>
              Change home
            </Button>
          </ButtonRow>
        </Stack>
      </CardContent>
      <Dialog open={asking} onClose={() => setAsking(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change home?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This app will ask for another home name or address. Your home and its settings stay as they are.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAsking(false)}>
            Stay here
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setAsking(false);
              bridge.changeHome?.();
            }}
          >
            Change home
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
