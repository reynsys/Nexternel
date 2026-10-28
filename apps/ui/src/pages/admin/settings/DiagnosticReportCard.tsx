import { useCallback, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { api, getStoredAccessToken, type ServerDiagnostics } from "../../../api";
import { buildClientSnapshot } from "../../../diagnostics/buildClientSnapshot";
import { clearDiagnosticErrors } from "../../../diagnostics/errorRing";
import { formatDiagnosticsReport, type AuthExtras } from "../../../diagnostics/formatReport";
import { copyTextToClipboard, downloadTextFile } from "../../../lib/copyText";
import { ButtonRow } from "../../../components/ButtonRow";

/** One text report of this browser and the server — to copy into a support message. */
export function DiagnosticReportCard() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const buildReport = useCallback(async (): Promise<string> => {
    let server: ServerDiagnostics | { error: string } | null = null;
    try {
      server = await api.diagnostics();
    } catch (err) {
      server = { error: err instanceof Error ? err.message : String(err) };
    }
    let auth: AuthExtras | null = null;
    if (getStoredAccessToken()) {
      try {
        const [me, caps] = await Promise.all([api.me(), api.capabilities()]);
        auth = { meUsername: me.user.username, capabilitiesCount: caps.capabilities.length };
      } catch (err) {
        auth = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    return formatDiagnosticsReport(buildClientSnapshot(), server, auth);
  }, []);

  async function run(action: "copy" | "download") {
    setBusy(true);
    setStatus(null);
    try {
      const report = await buildReport();
      if (action === "copy") {
        const result = await copyTextToClipboard(report);
        setStatus(
          result.ok
            ? { ok: true, text: "Report copied." }
            : { ok: false, text: `Copy failed — ${result.error}. Use Download instead.` }
        );
      } else {
        downloadTextFile(
          `nexternel-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
          report
        );
        setStatus({ ok: true, text: "Report downloaded." });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box>
        <Typography variant="subtitle1" gutterBottom>
          Report for support
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Versions, status and recent errors seen in this browser, to send when you ask for help.
        </Typography>
        {status && (
          <Alert severity={status.ok ? "success" : "warning"} sx={{ mb: 2 }} onClose={() => setStatus(null)}>
            {status.text}
          </Alert>
        )}
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
          <Button variant="contained" disabled={busy} onClick={() => void run("copy")}>
            Copy report
          </Button>
          <Button variant="outlined" disabled={busy} onClick={() => void run("download")}>
            Download
          </Button>
          <Button
            color="inherit"
            disabled={busy}
            onClick={() => {
              clearDiagnosticErrors();
              setStatus({ ok: true, text: "Error log cleared." });
            }}
          >
            Clear error log
          </Button>
        </ButtonRow>
    </Box>
  );
}
