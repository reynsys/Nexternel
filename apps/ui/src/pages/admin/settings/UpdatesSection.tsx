import { CODE_TEXT } from "../../../lib/appearance/type";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Stack,
  Typography,
} from "@mui/material";
import { api, type UpdateStatus } from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { ButtonRow } from "../../../components/ButtonRow";
import { FactGrid, type FactItem } from "../../../components/FactGrid";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";

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
/** Settings → System → Overview: the Updates part (a section of the System card). */
export function UpdatesSection() {
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
    const version = status?.latest?.version;
    if (!version) return;
    const ok = await confirm({
      title: `Update to ${version}?`,
      message:
        "Nexternel is unavailable for a few minutes. Settings, devices and dashboards are kept; if anything goes wrong, " +
        "the current version comes back by itself.",
      confirmLabel: "Update now",
      destructive: false,
    });
    if (!ok) return;
    target.current = version;
    // One press: the server downloads the new version first when needed, then installs it.
    await run("start", api.startUpdate);
    // Show the maintenance banner straight away.
    window.dispatchEvent(new Event("nexternel:maintenance"));
  }

  const latest = status?.latest;
  const run_ = status?.run;
  if (run_?.target) target.current = run_.target;

  /** The Status row: one short value, coloured by what it means. */
  const statusFact = (s: UpdateStatus): FactItem => {
    if (updating) {
      return {
        label: "Status",
        value: (
          <Stack direction="row" spacing={1} alignItems="center" component="span">
            <CircularProgress size={14} color="inherit" />
            <span>
              Updating to {target.current ?? "the new version"}
              {run_?.step ? `: ${run_.step}` : ""}
            </span>
          </Stack>
        ),
        tone: "warn",
      };
    }
    if (s.lastCheckError) return { label: "Status", value: `Could not check: ${s.lastCheckError}`, tone: "warn" };
    if (s.updateAvailable && latest) return { label: "Status", value: `${latest.version} available`, tone: "warn" };
    if (s.lastCheckedAt) {
      return {
        label: "Status",
        value: (
          <Stack direction="row" spacing={0.5} alignItems="center" component="span">
            <span>Up to date</span>
            <CheckRoundedIcon fontSize="inherit" />
          </Stack>
        ),
        tone: "good",
      };
    }
    return { label: "Status", value: "Not checked yet" };
  };

  return (
        <Stack spacing={2}>
          <Typography variant="h6">Updates</Typography>
          {!status ? (
            error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />
          ) : (
            <>
              <FactGrid
                items={[
                  { label: "Installed", value: `Nexternel ${status.current}` },
                  statusFact(status),
                  ...(status.lastCheckedAt ? [{ label: "Last checked", value: when(status.lastCheckedAt) }] : []),
                  ...(run_?.state === "succeeded" && run_.startedAt ? [{ label: "Last update", value: when(run_.startedAt) }] : []),
                ]}
              />
              {run_?.state === "failed" && !updating ? (
                <Alert severity="error">The update to {run_.target} did not finish; the previous version is back.</Alert>
              ) : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              {canManage ? (
                <ButtonRow direction={{ xs: "column", sm: "row" }}>
                  {status.updateAvailable && latest && status.canUpdate ? (
                    <Button variant="contained" disabled={busy !== null || updating} onClick={() => void update()}>
                      {busy === "start" ? "Starting…" : `Update to ${latest.version}`}
                    </Button>
                  ) : null}
                  <Button variant="outlined" disabled={busy !== null || updating} onClick={() => void run("check", api.checkForUpdate)}>
                    {busy === "check" ? "Checking…" : "Check for update"}
                  </Button>
                </ButtonRow>
              ) : null}
              {status.updateAvailable && !status.canUpdate ? (
                <Typography variant="body2" color="text.secondary">
                  Updating from here is switched off on this server.
                </Typography>
              ) : null}
              {status.updateAvailable && latest?.notes ? (
                <Box>
                  <Button size="small" onClick={() => setShowNotes((v) => !v)}>
                    What is new in {latest.version}
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
  );
}
