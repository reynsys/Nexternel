import { pushDiagnosticError } from "../diagnostics/errorRing";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { APP_VERSION } from "../version";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catch faults that escape page-level boundaries (e.g. layout / auth shell). */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in Settings → System → Diagnostic report, so a message that flashes past can be read later.
    pushDiagnosticError({ kind: "error", message: `App: ${error.message}`, source: info.componentStack?.split("\n").find((l) => l.trim())?.trim() });
    console.error("App render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8, px: 2 }} spacing={2}>
          <Alert severity="error" sx={{ maxWidth: 560 }}>
            Something went wrong: {this.state.error.message}
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, textAlign: "center" }}>
            Try a hard refresh (Ctrl+Shift+R). If this persists, open Troubleshoot and check the
            browser console (F12).
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Typography variant="caption" color="text.secondary">
            {APP_VERSION}
          </Typography>
        </Stack>
      );
    }
    return this.props.children;
  }
}
