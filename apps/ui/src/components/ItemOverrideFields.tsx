import { useState } from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { ItemIcon } from "../lib/icons/ItemIcon";
import { overrideHasValue, type ItemOverride } from "../lib/panel-item-display";
import { SWITCH_STYLES, type SwitchStyleId } from "../lib/switch-styles";
import { IconPicker } from "./IconPicker";

type Props = {
  /** The item's own name (the reading's), shown as the placeholder. */
  defaultName: string;
  /** The item's own icon ("auto" or a catalogue id) and kind, for the preview. */
  defaultIcon?: string | null;
  kind?: string | null;
  value: ItemOverride | undefined;
  onChange: (next: ItemOverride | undefined) => void;
  /** This item is a switch: offer its own switch style. */
  isSwitch?: boolean;
};

/** This panel's own name and icon for one item — shared by every panel item list. */
export function ItemOverrideFields({ defaultName, defaultIcon, kind, value, onChange, isSwitch = false }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const icon = value?.icon ?? "auto";

  function update(patch: ItemOverride) {
    const next: ItemOverride = { ...value, ...patch };
    if (!next.name?.trim()) delete next.name;
    if (!next.icon || next.icon === "auto") delete next.icon;
    if (!next.switchStyle) delete next.switchStyle;
    onChange(overrideHasValue(next) ? next : undefined);
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
          {overrideHasValue(value) && (
            <Button size="small" onClick={() => onChange(undefined)}>
              Reset
            </Button>
          )}
        </Stack>
        {isSwitch && (
          <FormControl fullWidth size="small">
            <InputLabel id="item-switch-style">Switch style</InputLabel>
            <Select
              labelId="item-switch-style"
              label="Switch style"
              value={value?.switchStyle ?? "panel"}
              onChange={(e) =>
                update({ switchStyle: e.target.value === "panel" ? undefined : (e.target.value as SwitchStyleId) })
              }
            >
              <MenuItem value="panel">Same as the panel (Look tab)</MenuItem>
              {SWITCH_STYLES.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
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
