import type { PanelContentMode } from "@nexternel/domain";
import type { CameraRecord } from "../api";

/**
 * Cameras a camera panel shows — one rule for the panel body and its title strip.
 * Hand-picked: exactly the picked cameras, in the picked order (an area never hides them).
 * Automatic: every enabled camera, narrowed to the panel's areas when it has any.
 */
export function visiblePanelCameras(
  all: readonly CameraRecord[],
  scope: { areaIds: readonly string[]; contentMode: PanelContentMode; cameraIds: readonly string[] }
): CameraRecord[] {
  const enabled = all.filter((c) => c.enabled);
  if (scope.contentMode === "manual") {
    const byId = new Map(enabled.map((c) => [c.id, c]));
    return scope.cameraIds.map((id) => byId.get(id)).filter((c): c is CameraRecord => Boolean(c));
  }
  const inArea =
    scope.areaIds.length > 0
      ? enabled.filter((c) => c.areaId && scope.areaIds.includes(c.areaId))
      : enabled;
  return [...inArea].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
