import { useEffect, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import { api, type BoardUpdateLog } from "../../../api";
import { CODE_TEXT } from "../../../lib/appearance/type";
import { StepIcon } from "./BoardUpdatesCard";

/**
 * "Show details" for one board update: its outcome in plain words, when it ran, and everything
 * ESPHome wrote while preparing and sending it (kept by Nexternel, the last 10 per board), to copy
 * for troubleshooting.
 */
export function BoardUpdateDetailsButton({ logId, name }: { logId: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="small" variant="outlined" startIcon={<ArticleRoundedIcon />} onClick={() => setOpen(true)}>
        Show details
      </Button>
      {open ? <BoardUpdateDetailsDialog logId={logId} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The lines where ESPHome reported a problem (the last 12), shown above the full record. */
export function reportedProblems(log: string): string[] {
  return log
    .split("\n")
    .filter((l) => /^\s*(ERROR|WARNING|FAILED)\b/.test(l) || /\b(error|failed):/i.test(l))
    .filter((l) => !/^\s*FAILED: /.test(l))
    .slice(-12);
}

function BoardUpdateDetailsDialog({ logId, name, onClose }: { logId: string; name: string; onClose: () => void }) {
  const [entry, setEntry] = useState<BoardUpdateLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const problems = entry ? reportedProblems(entry.log) : [];
  useEffect(() => {
    api
      .boardUpdateLog(logId)
      .then((r) => setEntry(r.entry))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the details"));
  }, [logId]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Update details — {name}</DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {entry ? (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ pt: 0.25 }}>
                <StepIcon step={entry.outcome === "failed" ? "failed" : "done"} />
              </Box>
              <Box>
                <Typography variant="body2" color={entry.outcome === "failed" ? "error" : "text.primary"}>
                  {entry.message}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.startedAt).toLocaleString()} – {new Date(entry.finishedAt).toLocaleTimeString()}
                </Typography>
              </Box>
            </Stack>
            {problems.length ? (
              <>
                <Typography variant="subtitle2">What ESPHome reported as errors and warnings</Typography>
                <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: 1, bgcolor: "action.hover", ...CODE_TEXT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {problems.join("\n")}
                </Box>
              </>
            ) : null}
            <Typography variant="subtitle2">Everything ESPHome wrote</Typography>
            <Box
              component="pre"
              sx={{ m: 0, p: 1.5, maxHeight: "55vh", overflow: "auto", borderRadius: 1, bgcolor: "action.hover", ...CODE_TEXT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {entry.log}
            </Box>
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="outlined"
          startIcon={<ContentCopyRoundedIcon />}
          disabled={!entry}
          onClick={() => {
            if (!entry) return;
            void navigator.clipboard
              ?.writeText(`${name}: ${entry.message}\n${entry.startedAt}\n\n${entry.log}`)
              .then(() => setCopied(true))
              .catch(() => undefined);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
