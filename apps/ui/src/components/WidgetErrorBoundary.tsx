import { pushDiagnosticError } from "../diagnostics/errorRing";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Typography } from "@mui/material";

type Props = {
  children: ReactNode;
  widgetId?: string;
  widgetType?: string;
  /** When this changes (e.g. the panel's settings), a panel that failed is drawn again. */
  resetKey?: string;
};

type State = { error: Error | null };

/** Isolate a single widget fault so the rest of the dashboard keeps rendering. */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    // A fault is often tied to one set of settings: new settings get a fresh try.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in Settings → System → Diagnostic report, so a message that flashes past can be read later.
    pushDiagnosticError({ kind: "error", message: `Panel: ${error.message}`, source: info.componentStack?.split("\n").find((l) => l.trim())?.trim() });
    console.error("Widget render error", this.props.widgetId, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Alert severity="warning" sx={{ m: 1, py: 0.5 }}>
          <Typography variant="caption" component="div">
            This panel could not be drawn ({this.state.error.message}). It tries again when its settings change; the
            details are in Settings → System → Diagnostic report.
          </Typography>
        </Alert>
      );
    }
    return this.props.children;
  }
}
