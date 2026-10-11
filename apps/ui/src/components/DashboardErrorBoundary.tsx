import { pushDiagnosticError } from "../diagnostics/errorRing";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { APP_VERSION } from "../version";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Prevent a single widget/render fault from blanking the whole dashboard. */
export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in Settings → System → Diagnostic report, so a message that flashes past can be read later.
    pushDiagnosticError({ kind: "error", message: `Dashboard: ${error.message}`, source: info.componentStack?.split("\n").find((l) => l.trim())?.trim() });
    console.error("Dashboard render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Stack spacing={2} sx={{ py: 4 }}>
          <Alert severity="error">
            Dashboard could not render: {this.state.error.message}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Try a hard refresh (Ctrl+Shift+R). If this persists, open Troubleshoot for
            browser console errors, or re-save the dashboard in edit mode.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
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
