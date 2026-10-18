import { groupByArea } from "../lib/group-by-area";
import { Fragment, useMemo, useState } from "react";
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { CameraRecord } from "../api";
import { useConfirm } from "./confirm";
import { ItemOverrideFields } from "./ItemOverrideFields";
import type { ItemOverride } from "../lib/panel-item-display";
import { insetSx } from "../skins/surfaceStyles";
import { ButtonRow } from "./ButtonRow";

type Props = {
  options: CameraRecord[];
  value: string[];
  onChange: (ids: string[]) => void;
  heading: string;
  disabled?: boolean;
  /** This panel's own names and icons per item; editing is offered when onOverridesChange is set. */
  overrides?: Record<string, ItemOverride>;
  onOverridesChange?: (next: Record<string, ItemOverride>) => void;
};

function reorderIds(ids: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) {
    return ids;
  }
  const next = [...ids];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export function PanelCameraOrderList({
  options,
  value,
  onChange,
  heading,
  disabled = false,
  overrides = {},
  onOverridesChange,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addId, setAddId] = useState("");
  const { confirm } = useConfirm();

  const byId = useMemo(() => new Map(options.map((c) => [c.id, c])), [options]);

  const selected = useMemo(
    () => value.map((id) => byId.get(id)).filter((c): c is CameraRecord => Boolean(c)),
    [value, byId]
  );

  const available = useMemo(
    () => options.filter((c) => !value.includes(c.id)),
    [options, value]
  );

  function removeId(id: string) {
    void (async () => {
      const cam = byId.get(id);
      const ok = await confirm({
        title: "Remove camera?",
        message: cam
          ? `Remove “${cam.name}” from this panel’s camera list?`
          : "Remove this camera from the list?",
        confirmLabel: "Remove",
      });
      if (ok) onChange(value.filter((v) => v !== id));
    })();
  }

  function addSelected() {
    if (!addId || value.includes(addId)) return;
    onChange([...value, addId]);
    setAddId("");
  }

  return (
    <ButtonRow>
      <Typography variant="subtitle2">{heading}</Typography>
      {selected.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No cameras selected yet. Add one below.
        </Typography>
      ) : (
        <List dense disablePadding>
          {selected.map((cam, index) => (
            <Fragment key={cam.id}>
            <ListItem
              disableGutters
              draggable={!disabled}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex == null || dragIndex === index) return;
                onChange(reorderIds(value, dragIndex, index));
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              secondaryAction={
                <ButtonRow direction="row">
                  {onOverridesChange && (
                    <IconButton
                      size="small"
                      aria-label="Name and icon on this panel"
                      aria-expanded={editingId === cam.id}
                      color={overrides[cam.id] ? "primary" : "default"}
                      disabled={disabled}
                      onClick={() => setEditingId(editingId === cam.id ? null : cam.id)}
                    >
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    aria-label="Move up"
                    disabled={disabled || index === 0}
                    onClick={() => onChange(reorderIds(value, index, index - 1))}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Move down"
                    disabled={disabled || index === selected.length - 1}
                    onClick={() => onChange(reorderIds(value, index, index + 1))}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label="Remove"
                    disabled={disabled}
                    onClick={() => removeId(cam.id)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ButtonRow>
              }
              sx={[
                insetSx(),
                { mb: 0.75, pr: onOverridesChange ? 18 : 14 },
                dragIndex === index ? { bgcolor: "action.hover" } : {},
              ]}
            >
              <DragIndicatorIcon
                fontSize="small"
                sx={{ mr: 1, color: "text.disabled", cursor: disabled ? "default" : "grab" }}
              />
              <ListItemText primary={overrides[cam.id]?.name ?? cam.name} />
            </ListItem>
            {onOverridesChange && editingId === cam.id && (
              <ItemOverrideFields
                defaultName={cam.name}
                defaultIcon={"auto"}
                kind={"camera"}
                value={overrides[cam.id]}
                onChange={(next) => {
                  const all = { ...overrides };
                  if (next) all[cam.id] = next;
                  else delete all[cam.id];
                  onOverridesChange(all);
                }}
              />
            )}
            </Fragment>
          ))}
        </List>
      )}

      {available.length > 0 && (
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel id="panel-add-camera">Add camera</InputLabel>
            <Select
              labelId="panel-add-camera"
              label="Add camera"
              value={addId}
              onChange={(e) => setAddId(String(e.target.value))}
            >
              <MenuItem value="">—</MenuItem>
              {groupByArea(available, (cam) => cam.areaName).flatMap((group) => [
                <ListSubheader key={`area-${group.area}`}>{group.area}</ListSubheader>,
                ...group.items.map((cam) => (
                  <MenuItem key={cam.id} value={cam.id}>
                    {cam.name}
                  </MenuItem>
                )),
              ])}
            </Select>
          </FormControl>
          <Box sx={{ pb: 0.25 }}>
            <IconButton
              color="primary"
              disabled={disabled || !addId}
              aria-label="Add camera"
              onClick={addSelected}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Stack>
      )}

      {options.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No cameras in this scope — register cameras under Admin → Cameras or widen the place
          filter.
        </Typography>
      )}
    </ButtonRow>
  );
}
