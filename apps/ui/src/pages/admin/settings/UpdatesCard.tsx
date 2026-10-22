import { CODE_TEXT } from "../../../lib/appearance/type";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Collapse,
  Stack,
  Typography,
} from "@mui/material";
import { api, type UpdateStatus } from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { ButtonRow } from "../../../components/ButtonRow";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Release notes: "- " lines become bullets; "**text**" is shown bold. */
function Notes({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() && !/^Update with:/i.test(l.trim()));
  return (
    <Stack spacing={0.5}>
      {lines.map((l, i) => {
        const indent = /^\s{2,}[-*]/.test(l) ? 4 : /^\s*[-*]/.test(l) ? 2 : 0;
        const clean = l.replace(/^\s*[-*]\s+/, "");
        const parts = clean.split(/\*\*(.+?)\*\*/g);
        return (
          <Typography key={i} variant="body2" sx={{ pl: indent, textIndent: indent ? "-0.9em" : 0 }}>
            {indent ? "• " : ""}
            {parts.map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p))}
          </Typography>
        );
      })}
    </Stack>
  );
}

/** Settings → System: see whether a newer Nexternel exists, download it and install it. */
export function UpdatesCard() {
  const surfaceSx = useContentSurfaceSx();
  const { confirm } = useConfirm();
  const { isAdmin, permissions } = useShellAuth();
  const canManage = hasPermission(permissions, "manageUsers", Boolean(isAdmin));
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState<"check" | "download" | "start" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const target = useRef<string | null>(null);

  const load = useCallback(async () => {
    const s = await api.updateStatus();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Could not load update information"));
  }, [load]);

  // While updating, Nexternel restarts: keep asking until the new version answers, then reload.
  const updating = status?.run.state === "updating" || restarting;
  useEffect(() => {
    if (!updating) return;
    const timer = setInterval(async () => {
      try {
        const health = await api.health();
        if (target.current && health.version === target.current) {
          window.location.reload();
          return;
        }
        const s = await load();
        if (s.run.state !== "updating") setRestarting(false);
      } catch {
        setRestarting(true); // Nexternel is restarting; keep waiting
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [updating, load]);

  async function run(kind: "check" | "download" | "start", action: () => Promise<UpdateStatus>) {
    setBusy(kind);
    setError(null);
    try {
      setStatus(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function update() {
    if (!status?.downloaded) return;
    const ok = await confirm({
      title: `Update to ${status.downloaded}?`,
      message:
        "Nexternel will be unavailable for a few minutes while it rebuilds. Your settings, devices and dashboards are kept, " +
        "a copy of your settings is saved first, and if anything goes wrong the current version is put back by itself.",
      confirmLabel: "Update now",
      destructive: false,
    });
    if (!ok) return;
    target.current = status.downloaded;
    await run("start", api.startUpdate);
    // Show the maintenance banner straight away.
    window.dispatchEvent(new Event("nexternel:maintenance"));
  }

  const latest = status?.latest;
  const run_ = status?.run;
  if (run_?.target) target.current = run_.target;

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Updates</Typography>
          {!status ? (
            error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />
          ) : (
            <>
              <Typography variant="body2">
                This is Nexternel <strong>{status.current}</strong>.{" "}
                {status.updateAvailable && latest
                  ? `Version ${latest.version} is available${latest.publishedAt ? ` (published ${when(latest.publishedAt)})` : ""}.`
                  : status.lastCheckedAt && !status.lastCheckError
                    ? "It is the newest version."
                    : ""}
              </Typography>
              {status.lastCheckedAt ? (
                <Typography variant="caption" color="text.secondary">
                  Last checked {when(status.lastCheckedAt)}. Nexternel checks by itself every night at {status.nightlyCheck}.
                </Typography>
              ) : null}
              {status.lastCheckError ? (
                <Alert severity="warning">Could not check for updates: {status.lastCheckError}</Alert>
              ) : null}

              {updating ? (
                <Alert severity="info" icon={<CircularProgress size={18} color="inherit" />}>
                  Updating to {target.current ?? "the new version"}. This takes a few minutes; Nexternel restarts on the
                  way and this page reloads by itself when it is done.
                  {run_?.step ? (
                    <Box component="span" sx={{ display: "block", mt: 0.5 }}>
                      Now: {run_.step}
                    </Box>
                  ) : null}
                </Alert>
              ) : null}
              {run_?.state === "succeeded" && !updating && run_.target ? (
                <Typography variant="body2" color="text.secondary">
                  Last update: {run_.target}
                  {run_.startedAt ? `, installed on ${when(run_.startedAt)}` : ""}.
                </Typography>
              ) : null}
              {run_?.state === "failed" && !updating ? (
                <Alert severity="error">
                  The update to {run_.target} did not finish, so Nexternel put the previous version back. You can try again
                  with Update; "Show details" below shows where it stopped.
                </Alert>
              ) : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              {canManage ? (
                <ButtonRow direction={{ xs: "column", sm: "row" }}>
                  <Button variant="outlined" disabled={busy !== null || updating} onClick={() => void run("check", api.checkForUpdate)}>
                    {busy === "check" ? "Checking…" : "Check for update"}
                  </Button>
                  {status.updateAvailable && latest && status.downloaded !== latest.version ? (
                    <Button variant="contained" disabled={busy !== null || updating} onClick={() => void run("download", api.downloadUpdate)}>
                      {busy === "download" ? "Downloading…" : "Download"}
                    </Button>
                  ) : null}
                  {status.downloaded ? (
                    <Button
                      variant="contained"
                      color="success"
                      disabled={busy !== null || updating || !status.canUpdate}
                      onClick={() => void update()}
                    >
                      {busy === "start" ? "Starting…" : "Update"}
                    </Button>
                  ) : null}
                </ButtonRow>
              ) : null}
              {status.downloaded && !status.canUpdate ? (
                <Typography variant="body2" color="text.secondary">
                  Updating from here is switched off on this server.
                </Typography>
              ) : null}

              {status.updateAvailable && latest?.notes ? (
                <Box>
                  <Button size="small" onClick={() => setShowNotes((v) => !v)}>
                    {showNotes ? "Hide" : "Show"} what is new in {latest.version}
                  </Button>
                  <Collapse in={showNotes}>
                    <Box sx={{ pt: 1 }}>
                      <Notes text={latest.notes} />
                    </Box>
                  </Collapse>
                </Box>
              ) : null}

              {run_?.log && (updating || run_.state === "failed" || run_.state === "succeeded") ? (
                <Box>
                  <Button size="small" onClick={() => setShowLog((v) => !v)}>
                    {showLog ? "Hide" : "Show"} details
                  </Button>
                  <Collapse in={showLog}>
                    <Box
                      component="pre"
                      sx={{ m: 0, mt: 1, p: 1.5, maxHeight: 260, overflow: "auto", borderRadius: 1, bgcolor: "action.hover", ...CODE_TEXT, whiteSpace: "pre-wrap" }}
                    >
                      {run_.log}
                    </Box>
                  </Collapse>
                </Box>
              ) : null}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
