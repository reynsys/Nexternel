import { Stack } from "@mui/material";
import type { ItemOverride } from "../lib/panel-item-display";
import type { ResolvedPanelCapability } from "../api";
import { panelItemPickerHeading } from "../lib/panel-content-copy";
import { PanelCapabilityOrderList } from "./PanelCapabilityOrderList";

type Props = {
  panelKind: string;
  capabilityIds: string[];
  onCapabilityIdsChange: (ids: string[]) => void;
  options: ResolvedPanelCapability[];
  disabled?: boolean;
  overrides?: Record<string, ItemOverride>;
  onOverridesChange?: (next: Record<string, ItemOverride>) => void;
};

export function PanelContentFields({
  panelKind,
  capabilityIds,
  onCapabilityIdsChange,
  options,
  disabled = false,
  overrides,
  onOverridesChange,
}: Props) {
  return (
    <Stack spacing={1.5}>
      <PanelCapabilityOrderList
        options={options}
        value={capabilityIds}
        onChange={onCapabilityIdsChange}
        heading={panelItemPickerHeading(panelKind)}
        disabled={disabled}
        overrides={overrides}
        onOverridesChange={onOverridesChange}
      />
    </Stack>
  );
}
