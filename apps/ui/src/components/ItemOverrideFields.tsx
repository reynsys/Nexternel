import { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { ItemIcon } from "../lib/icons/ItemIcon";
import type { ItemOverride } from "../lib/panel-item-display";
import { IconPicker } from "./IconPicker";

type Props = {
  /** The item's own name (the reading's), shown as the placeholder. */
  defaultName: string;
  /** The item's own icon ("auto" or a catalogue id) and kind, for the preview. */
  defaultIcon?: string | null;
  kind?: string | null;
  value: ItemOverride | undefined;
  onChange: (next: ItemOverride | undefined) => void;
};

/** This panel's own name and icon for one item — shared by every panel item list. */
export function ItemOverrideFields({ defaultName, defaultIcon, kind, value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const icon = value?.icon ?? "auto";

  function update(patch: ItemOverride) {
    const next: ItemOverride = { ...value, ...patch };
    if (!next.name?.trim()) delete next.name;
    if (!next.icon || next.icon === "auto") delete next.icon;
    onChange(next.name || next.icon ? next : undefined);
  }

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderTop: 0, borderRadius: "0 0 8px 8px", p: 1.5, mt: -0.75, mb: 0.75 }}>
      <Stack spacing={1.25}>
        <TextField
          size="small"
          label="Name on this panel"
          placeholder={defaultName}
          value={value?.name ?? ""}
          onChange={(e) => update({ name: e.target.value })}
          helperText="Leave empty to use the reading's name."
          inputProps={{ maxLength: 60 }}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary" sx={{ width: 40 }}>
            Icon
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setPickerOpen(true)}
            startIcon={
              icon === "none" ? (
                <BlockIcon />
              ) : (
                <ItemIcon iconId={icon === "auto" ? (defaultIcon ?? "auto") : icon} kind={kind} />
              )
            }
          >
            {icon === "auto" ? "Reading's icon" : icon === "none" ? "No icon" : "Chosen icon"}
          </Button>
          {(value?.name || value?.icon) && (
            <Button size="small" onClick={() => onChange(undefined)}>
              Reset
            </Button>
          )}
        </Stack>
      </Stack>
      <IconPicker
        inline
        open={pickerOpen}
        value={icon}
        kind={kind}
        autoIconId={defaultIcon}
        autoLabel="Reading's icon"
        allowNone
        onChange={(next) => update({ icon: next })}
        onClose={() => setPickerOpen(false)}
      />
    </Box>
  );
}
