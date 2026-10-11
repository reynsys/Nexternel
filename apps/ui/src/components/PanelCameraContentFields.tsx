import { Stack } from "@mui/material";
import type { ItemOverride } from "../lib/panel-item-display";
import type { CameraRecord } from "../api";
import { panelItemPickerHeading } from "../lib/panel-content-copy";
import { PanelCameraOrderList } from "./PanelCameraOrderList";

type Props = {
  cameraIds: string[];
  onCameraIdsChange: (ids: string[]) => void;
  options: CameraRecord[];
  disabled?: boolean;
  overrides?: Record<string, ItemOverride>;
  onOverridesChange?: (next: Record<string, ItemOverride>) => void;
};

export function PanelCameraContentFields({
  cameraIds,
  onCameraIdsChange,
  options,
  disabled = false,
  overrides,
  onOverridesChange,
}: Props) {
  return (
    <Stack spacing={1.5}>
      <PanelCameraOrderList
        options={options}
        value={cameraIds}
        onChange={onCameraIdsChange}
        heading={panelItemPickerHeading("panel.camera")}
        disabled={disabled}
        overrides={overrides}
        onOverridesChange={onOverridesChange}
      />
    </Stack>
  );
}
