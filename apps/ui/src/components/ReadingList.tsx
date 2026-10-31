import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { Box, Checkbox, InputAdornment, List, ListItemButton, ListItemText, Radio, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import type { Capability } from "../api";
import { capabilityOptionPrimary, filterCapabilitiesForPicker, sortCapabilitiesForPicker } from "../lib/capability-picker";
import { groupByArea } from "../lib/group-by-area";
import { tidyDeviceName } from "../lib/capability-labels";
import { parseCapabilityReading } from "../panels/parse-capability-reading";
import { insetSx } from "../skins/surfaceStyles";
import { useOptionalDashboardDataRuntime } from "../lib/dashboard-data-runtime";

/** A reading's value as the panels show it, kept live (the dashboard's live readings, else the last known). */
function LiveValue({ cap }: { cap: Capability }) {
  const runtime = useOptionalDashboardDataRuntime();
  const subscribe = useCallback(
    (listener: () => void) => (runtime ? runtime.capabilities.subscribe([cap.id], listener) : () => undefined),
    [runtime, cap.id]
  );
  const get = useCallback(() => runtime?.capabilities.get(cap.id) ?? null, [runtime, cap.id]);
  const live = useSyncExternalStore(subscribe, get, get);
  const reading = parseCapabilityReading({ state: live ?? cap.state, unit: cap.unit });
  return (
    <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, whiteSpace: "nowrap" }}>
      {reading.value}
      {reading.unit ? ` ${reading.unit}` : ""}
    </Typography>
  );
}

type Props = {
  options: Capability[];
  /** The chosen readings (in the order they were chosen). */
  value: string[];
  onChange: (ids: string[]) => void;
  /** One reading (a gauge) or several (a values panel, a chart). */
  mode: "single" | "multiple";
  /** "Which reading?" — said above the list. */
  heading: string;
};

/**
 * Choosing exactly what a panel shows: every reading in plain sight, grouped by area, each with
 * its device and its live value, so it is easy to be sure it is the right one. A search narrows it.
 */
export function ReadingList({ options, value, onChange, mode, heading }: Props) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const shown = query.trim() ? filterCapabilitiesForPicker(options, query) : sortCapabilitiesForPicker(options);
    return groupByArea(shown, (c) => c.roomName);
  }, [options, query]);

  function pick(id: string) {
    if (mode === "single") return onChange([id]);
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Typography variant="subtitle2">{heading}</Typography>
      <TextField
        size="small"
        fullWidth
        placeholder="Search, e.g. temperature"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      {groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {options.length ? "Nothing matches your search." : "There is nothing of this kind yet. Add a device first (Devices)."}
        </Typography>
      ) : null}
      {groups.map((group) => (
        <Box key={group.area}>
          <Typography variant="overline" color="text.secondary" sx={{ display: "block", lineHeight: 1.4, mb: 0.5 }}>
            {group.area}
          </Typography>
          <List dense disablePadding sx={[insetSx(), { p: 0, overflow: "hidden" }]}>
            {group.items.map((cap) => {
              const chosen = value.includes(cap.id);
              return (
                <ListItemButton
                  key={cap.id}
                  selected={chosen}
                  onClick={() => pick(cap.id)}
                  sx={{ gap: 1, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
                >
                  {mode === "single" ? (
                    <Radio edge="start" size="small" checked={chosen} tabIndex={-1} disableRipple inputProps={{ "aria-label": capabilityOptionPrimary(cap) }} />
                  ) : (
                    <Checkbox edge="start" size="small" checked={chosen} tabIndex={-1} disableRipple inputProps={{ "aria-label": capabilityOptionPrimary(cap) }} />
                  )}
                  <ListItemText
                    primary={capabilityOptionPrimary(cap)}
                    secondary={tidyDeviceName(cap.deviceName, cap.roomName) || cap.deviceName}
                    primaryTypographyProps={{ variant: "body2", fontWeight: chosen ? "fontWeightBold" : undefined }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                  <LiveValue cap={cap} />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      ))}
    </Box>
  );
}
