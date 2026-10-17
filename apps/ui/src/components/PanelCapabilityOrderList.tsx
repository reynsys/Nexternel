import { groupByArea } from "../lib/group-by-area";
import { Fragment, useMemo, useState } from "react";
import {
  Chip,
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
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import type { ResolvedPanelCapability } from "../api";
import { capabilityKindLabel } from "../lib/capability-kind-labels";
import {
  capabilityOptionContextLine,
  capabilityOptionPrimary,
} from "../lib/capability-picker";
import { asSwitchCapability } from "../panels/panel-capabilities";
import { useConfirm } from "./confirm";
import { ItemOverrideFields } from "./ItemOverrideFields";
import { isControllableResolvedCapability } from "../panels/panel-capabilities";
import type { ItemOverride } from "../lib/panel-item-display";
import { insetSx } from "../skins/surfaceStyles";

type Props = {
  options: ResolvedPanelCapability[];
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

export function PanelCapabilityOrderList({
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
    () => value.map((id) => byId.get(id)).filter((c): c is ResolvedPanelCapability => Boolean(c)),
    [value, byId]
  );

  const available = useMemo(
    () => options.filter((c) => !value.includes(c.id)),
    [options, value]
  );

  function removeId(id: string) {
    void (async () => {
      const cap = byId.get(id);
      const ok = await confirm({
        title: "Remove item?",
        message: cap
          ? `Remove “${capabilityOptionPrimary(cap)}” from this panel’s item list?`
          : "Remove this item from the list?",
        confirmLabel: "Remove",
      });
      if (ok) onChange(value.filter((v) => v !== id));
    })();
  }

  function addSelected(id: string) {
    const nextId = id.trim();
    if (!nextId || value.includes(nextId)) {
      setAddId("");
      return;
    }
    onChange([...value, nextId]);
    setAddId("");
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{heading}</Typography>
      {selected.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No items selected yet. Add one below.
        </Typography>
      ) : (
        <List dense disablePadding>
          {selected.map((cap, index) => (
            <Fragment key={cap.id}>
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
                <Stack direction="row" spacing={0.25}>
                  {onOverridesChange && (
                    <IconButton
                      size="small"
                      aria-label="Name and icon on this panel"
                      aria-expanded={editingId === cap.id}
                      color={overrides[cap.id] ? "primary" : "default"}
                      disabled={disabled}
                      onClick={() => setEditingId(editingId === cap.id ? null : cap.id)}
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
                    onClick={() => removeId(cap.id)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
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
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap>
                    <Typography variant="body2" noWrap>
                      {overrides[cap.id]?.name ?? capabilityOptionPrimary(asSwitchCapability(cap))}
                    </Typography>
                    <Chip label={capabilityKindLabel(cap.kind)} size="small" variant="outlined" />
                  </Stack>
                }
                secondary={capabilityOptionContextLine(asSwitchCapability(cap))}
                primaryTypographyProps={{ component: "div" }}
              />
            </ListItem>
            {onOverridesChange && editingId === cap.id && (
              <ItemOverrideFields
                defaultName={capabilityOptionPrimary(asSwitchCapability(cap))}
                defaultIcon={cap.icon ?? "auto"}
                kind={cap.kind}
                isSwitch={isControllableResolvedCapability(cap)}
                value={overrides[cap.id]}
                onChange={(next) => {
                  const all = { ...overrides };
                  if (next) all[cap.id] = next;
                  else delete all[cap.id];
                  onOverridesChange(all);
                }}
              />
            )}
            </Fragment>
          ))}
        </List>
      )}

      {available.length > 0 && (
        <FormControl fullWidth size="small" disabled={disabled}>
          <InputLabel id="panel-add-item">Add item</InputLabel>
          <Select
            labelId="panel-add-item"
            label="Add item"
            value={addId}
            onChange={(e) => addSelected(String(e.target.value))}
          >
            <MenuItem value="">—</MenuItem>
            {groupByArea(available, (cap) => cap.areaName).flatMap((group) => [
              <ListSubheader key={`area-${group.area}`}>{group.area}</ListSubheader>,
              ...group.items.map((cap) => (
              <MenuItem key={cap.id} value={cap.id}>
                <ListItemText
                  primary={capabilityOptionPrimary(asSwitchCapability(cap))}
                  secondary={capabilityOptionContextLine(asSwitchCapability(cap))}
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </MenuItem>
              )),
            ])}
          </Select>
        </FormControl>
      )}

      {options.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No items in this scope — adjust place or category first.
        </Typography>
      )}
    </Stack>
  );
}
