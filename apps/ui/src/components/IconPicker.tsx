import { useMemo, useState } from "react";
import {
  Box,
  ButtonBase,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import BlockIcon from "@mui/icons-material/Block";
import { ItemIcon, useIconCatalog } from "../lib/icons/ItemIcon";

type Props = {
  open: boolean;
  /** Current value: a catalogue id, "auto", or "none". */
  value: string;
  /** Kind of reading, to preview what "Automatic" shows. */
  kind?: string | null;
  /** What the "auto" choice shows when it is not the kind's icon (a panel item: the reading's own icon). */
  autoIconId?: string | null;
  /** Label for "auto" — e.g. "Automatic" (a reading) or "Reading's icon" (a panel item). */
  autoLabel: string;
  /** Offer "No icon" (panel items). */
  allowNone?: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
};

function Choice({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      sx={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        justifyItems: "center",
        gap: 0.5,
        py: 1,
        px: 0.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: selected ? "primary.main" : "transparent",
        bgcolor: selected ? "action.selected" : "transparent",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {children}
      <Typography
        variant="caption"
        sx={{ lineHeight: 1.2, textAlign: "center", width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}

const GRID_SX = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))", gap: 0.5 } as const;

/** Choose an icon for a reading or a panel item. The icon catalogue downloads when this opens. */
export function IconPicker({ open, value, kind, autoIconId, autoLabel, allowNone = false, onChange, onClose }: Props) {
  const catalog = useIconCatalog(open);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    if (!catalog) return [];
    return catalog.ICON_GROUPS.map((group) => ({
      group,
      icons: catalog.ICON_CATALOG.filter(
        (e) => e.group === group && (!q || e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q) || e.id.includes(q))
      ),
    })).filter((g) => g.icons.length > 0);
  }, [catalog, q]);

  function pick(next: string) {
    onChange(next);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        Choose an icon
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box sx={GRID_SX}>
            <Choice selected={value === "auto"} label={autoLabel} onClick={() => pick("auto")}>
              <ItemIcon iconId={autoIconId ?? "auto"} kind={kind} sx={{ fontSize: 26, color: "primary.main" }} />
            </Choice>
            {allowNone && (
              <Choice selected={value === "none"} label="No icon" onClick={() => pick("none")}>
                <BlockIcon sx={{ fontSize: 26, color: "text.secondary" }} />
              </Choice>
            )}
          </Box>
          <TextField
            size="small"
            placeholder="Search icons, e.g. door, heat, plug"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          {!catalog && <LinearProgress />}
          {catalog && groups.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No icon matches “{query}”.
            </Typography>
          )}
          {groups.map(({ group, icons }) => (
            <Box key={group}>
              <Typography variant="overline" color="text.secondary">
                {group}
              </Typography>
              <Box sx={GRID_SX}>
                {icons.map((e) => (
                  <Choice key={e.id} selected={value === e.id} label={e.label} onClick={() => pick(e.id)}>
                    <e.Icon sx={{ fontSize: 26, color: "primary.main" }} />
                  </Choice>
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
