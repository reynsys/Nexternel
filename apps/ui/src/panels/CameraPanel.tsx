import { CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { PanelContentMode } from "@nexternel/domain";
import { api, type CameraRecord } from "../api";
import { PanelTile } from "../components/PanelTile";
import { PanelItemGrid } from "../components/PanelItemGrid";
import type { PanelAppearanceLayout } from "../lib/panel-appearance";
import { useDashboardTileChrome } from "../lib/dashboard-tile-context";
import { PanelItemChrome } from "./PanelItemChrome";
import VideocamIcon from "@mui/icons-material/Videocam";
import { visiblePanelCameras } from "../lib/panel-cameras";
import { CameraWidget } from "../widgets/general/CameraWidget";
import type { WidgetInstance } from "../api";

type Props = {
  areaIds: string[];
  cameraIds?: string[];
  contentMode?: PanelContentMode;
  layout?: PanelAppearanceLayout;
};

/** Panel-embedded camera tiles — chrome shows the name; stream is video only. */
function cameraTileWidget(cam: CameraRecord): WidgetInstance {
  return {
    id: `cam-${cam.id}`,
    type: "camera",
    layout: { i: cam.id, x: 0, y: 0, w: 4, h: 3 },
    bindings: {},
    config: { cameraId: cam.id, embeddedInPanel: true },
  };
}

export function CameraPanel({
  areaIds,
  cameraIds = [],
  contentMode = "auto",
  layout = "card",
}: Props) {
  const [cameras, setCameras] = useState<CameraRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const areaKey = areaIds.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .cameras()
      .then((r) => {
        if (cancelled) return;
        setCameras(r.cameras);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setCameras([]);
        setError(err instanceof Error ? err.message : "Failed to load cameras");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => visiblePanelCameras(cameras, { areaIds, contentMode, cameraIds }),
    [cameras, areaKey, contentMode, cameraIds.join(",")]
  );
  const { showItemLabel, showItemContext } = useDashboardTileChrome();

  if (loading) {
    return (
      <PanelTile sx={{ alignItems: "center", justifyContent: "center" }}>
        <Stack spacing={1} alignItems="center">
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">
            Loading cameras…
          </Typography>
        </Stack>
      </PanelTile>
    );
  }

  if (error) {
    return (
      <PanelTile sx={{ typography: "body2", p: 1.5, color: "error.main" }}>{error}</PanelTile>
    );
  }

  if (visible.length === 0) {
    return (
      <PanelTile sx={{ typography: "body2", p: 1.5, color: "text.secondary" }}>
        {contentMode === "manual"
          ? "No cameras selected. Edit this panel and choose which cameras to show."
          : "No cameras in this scope. Register cameras under Admin → Cameras and link them to an Area."}
      </PanelTile>
    );
  }

  return (
    <PanelItemGrid layout={layout} rowSize="fluid" itemCount={visible.length}>
      {visible.map((cam) => {
        const name = cam.name.trim();
        return (
        <PanelItemChrome
          key={cam.id}
          title={showItemLabel ? name : null}
          showContext={showItemContext}
          contextLabel={cam.areaName?.trim() || null}
          icon={VideocamIcon}
          itemId={cam.id}
          contentSx={{ minHeight: 0 }}
        >
          <CameraWidget widget={cameraTileWidget(cam)} />
        </PanelItemChrome>
        );
      })}
    </PanelItemGrid>
  );
}
