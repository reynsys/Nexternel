import { useState } from "react";
import { Box, Button, Stack, TextField, Tooltip, Typography } from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import { ItemIcon } from "../lib/icons/ItemIcon";
import { IconPicker } from "./IconPicker";
import { PanelAreaLineFields } from "./PanelAreaLineFields";

export type AutomaticTitle = {
  /** The title the panel shows when none is typed. */
  title: string | null;
  /** The icon it shows when none is chosen (iconId null = none). */
  icon: { iconId: string | null; kind: string | null };
};

type Props = {
  title: string;
  onTitleChange: (title: string) => void;
  /** "auto", "none" or an icon id. */
  icon: string;
  onIconChange: (icon: string) => void;
  automatic: AutomaticTitle;
};

/** Title and icon of a panel's title bar — the same block at the top of every panel editor. */
export function PanelTitleFields({ title, onTitleChange, icon, onIconChange, automatic }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const autoTitle = automatic.title?.trim() || null;
  const typed = title.trim();
  const shownIcon = icon === "auto" ? automatic.icon.iconId : icon === "none" ? null : icon;

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Title &amp; icon</Typography>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Tooltip title="Choose the icon">
          <Button
            variant="outlined"
            aria-label="Choose the title icon"
            onClick={() => setPickerOpen(true)}
            sx={{ minWidth: 40, width: 40, height: 40, p: 0 }}
          >
            {shownIcon !== null ? (
              <ItemIcon iconId={shownIcon} kind={automatic.icon.kind} sx={{ color: "primary.main" }} />
            ) : (
              <BlockIcon sx={{ color: "text.secondary" }} />
            )}
          </Button>
        </Tooltip>
        <TextField
          label="Title"
          size="small"
          fullWidth
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={autoTitle ?? "No title"}
          InputLabelProps={{ shrink: true }}
          helperText={
            typed
              ? autoTitle
                ? `Clear it to go back to the automatic title, “${autoTitle}”.`
                : "Clear it to show no title."
              : autoTitle
                ? "Automatic — taken from what the panel shows. Type to replace it."
                : "Type a title to show one."
          }
        />
      </Stack>
      <Box>
        <IconPicker
          inline
          open={pickerOpen}
          value={icon}
          kind={automatic.icon.kind}
          autoIconId={automatic.icon.iconId}
          autoLabel="Automatic"
          allowNone
          onChange={onIconChange}
          onClose={() => setPickerOpen(false)}
        />
      </Box>
      <PanelAreaLineFields />
    </Stack>
  );
}
