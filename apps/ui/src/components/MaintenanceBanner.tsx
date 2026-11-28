import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, CircularProgress } from "@mui/material";
import { api, type Maintenance } from "../api";
import { APP_VERSION } from "../version";

const POLL_MS = 10_000;
const POLL_ACTIVE_MS = 5_000;

/**
 * Shown to everyone while Nexternel is in maintenance mode (updating or restoring a backup):
 * changes are paused. When an update finishes, offers to reload the page on the new version.
 */
export function MaintenanceBanner() {
  const [state, setState] = useState<Maintenance | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const wasActive = useRef(false);

  const load = useCallback(async () => {
    try {
      const m = await api.maintenance();
      setUnreachable(false);
      setState(m);
      if (wasActive.current && !m.active) {
        // Maintenance just ended: if Nexternel was updated, this page is the old version.
        const health = await api.health().catch(() => null);
        if (health && health.version !== APP_VERSION) setNewVersion(health.version);
      }
      wasActive.current = m.active;
    } catch {
      // During an update Nexternel restarts and cannot answer for a moment.
      if (wasActive.current) setUnreachable(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const onEvent = () => void load();
    window.addEventListener("nexternel:maintenance", onEvent);
    return () => window.removeEventListener("nexternel:maintenance", onEvent);
  }, [load]);

  const active = Boolean(state?.active) || unreachable;
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, active ? POLL_ACTIVE_MS : POLL_MS);
    return () => clearInterval(timer);
  }, [load, active]);

  if (newVersion) {
    return (
      <Alert severity="success">
        Nexternel was updated to {newVersion}.{" "}
        {/* The button sits with its sentence, not at the far edge of the screen. */}
        <Button size="small" variant="outlined" color="inherit" sx={{ ml: 1, py: 0 }} onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </Alert>
    );
  }
  if (!active) return null;
  const what = unreachable
    ? "Updating: Nexternel is restarting."
    : state?.reason === "restore"
      ? "Restoring a backup."
      : `Updating${state?.detail ? ` to ${state.detail}` : ""}.`;
  return (
    <Alert severity="warning" icon={<CircularProgress size={18} color="inherit" />}>
      {what} Changes wait until it finishes. Lights and switches keep working.
    </Alert>
  );
}
