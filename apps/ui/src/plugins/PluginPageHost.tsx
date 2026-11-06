import { lazy, Suspense } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Typography } from "@mui/material";
import { usePluginHost } from "./PluginHostContext";

// The tracking page brings the map library with it, so it loads only when opened.
const SetupPage = lazy(() => import("./pages/SetupPage").then((m) => ({ default: m.SetupPage })));
const TrackingPage = lazy(() => import("./pages/TrackingPage").then((m) => ({ default: m.TrackingPage })));

/** A page offered by a plugin, drawn by Nexternel. */
export function PluginPageHost() {
  const { pluginId, pageId } = useParams();
  const { plugins, loading } = usePluginHost();
  const plugin = plugins.find((p) => p.id === pluginId && p.enabled);
  const page = plugin?.pages?.find((p) => p.id === pageId);
  if (!page || !plugin) {
    if (loading || plugins.length === 0) return null;
    return <Navigate to="/" replace />;
  }
  const mapPanel = plugin.panels.find((p) => p.block === "map")?.id ?? null;
  return (
    <Suspense fallback={<Typography color="text.secondary">Loading…</Typography>}>
      {page.block === "setup" ? (
        <SetupPage key={page.id} pluginId={plugin.id} pageId={page.id} title={page.label} />
      ) : (
        <TrackingPage key={page.id} pluginId={plugin.id} pageId={page.id} title={page.label} mapPanelId={mapPanel} />
      )}
    </Suspense>
  );
}
