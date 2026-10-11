import { CapabilityPicker } from "./CapabilityPicker";
import type { WidgetBindingSlotDef } from "@nexternel/plugin-sdk";
import type { Capability } from "../api";
import { capabilitiesForSlot } from "../lib/slot-bindings";
import { Stack } from "@mui/material";

type Props = {
  slots: WidgetBindingSlotDef[];
  capabilities: Capability[];
  values: Record<string, string>;
  onChange: (key: string, capabilityId: string) => void;
};

export function SlotBindingFields({ slots, capabilities, values, onChange }: Props) {
  return (
    <Stack spacing={2}>
      {slots.map((slot) => {
        const pool = capabilitiesForSlot(capabilities, slot);
        const value = values[slot.key] ?? "";
        const valid = pool.some((c) => c.id === value);
        const effectiveValue = valid
          ? value
          : slot.required
            ? pool[0]?.id ?? ""
            : value;
        return (
          <CapabilityPicker
            key={slot.key}
            capabilities={pool}
            value={effectiveValue}
            onChange={(id) => onChange(slot.key, id)}
            label={slot.label}
            allowEmpty={!slot.required}
            disabled={pool.length === 0}
          />
        );
      })}
    </Stack>
  );
}
