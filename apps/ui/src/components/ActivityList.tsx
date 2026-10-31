import { useCallback, useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import WifiTetheringRoundedIcon from "@mui/icons-material/WifiTetheringRounded";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import { api, type ActivityEntry, type ActivityKind } from "../api";
import { useLiveChanges } from "../lib/live-changes";
import { ICON_SIZE } from "../lib/appearance/type";

const KIND: Record<ActivityKind, { label: string; icon: SvgIconComponent }> = {
  device: { label: "Online & offline", icon: WifiTetheringRoundedIcon },
  switch: { label: "Switches", icon: ToggleOnOutlinedIcon },
  update: { label: "Updates", icon: SystemUpdateAltRoundedIcon },
  dashboard: { label: "Dashboards", icon: DashboardRoundedIcon },
  system: { label: "Nexternel", icon: SettingsSuggestRoundedIcon },
};

/** Words that mean something went wrong, shown in the warning colour. */
const BAD = /offline|failed|lost|restarted|could not/i;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

/**
 * The Activity log as a list, newest first and grouped by day: time, what happened, and who did it
 * (for switches turned from Nexternel and dashboards). Filter by kind (`showFilters`) or one device;
 * new entries appear by themselves; Show older pages back.
 */
export function ActivityList({ deviceId, showFilters = true, pageSize = 100 }: { deviceId?: string; showFilters?: boolean; pageSize?: number }) {
  const [kind, setKind] = useState<ActivityKind | "">("");
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .activity({ kind: kind || undefined, deviceId, limit: pageSize })
      .then((r) => {
        setEntries(r.entries);
        setMore(r.entries.length === pageSize);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the activity"));
  }, [kind, deviceId, pageSize]);
  useEffect(load, [load]);
  // New entries (this screen or another): reload; a board going on- or offline changes "devices".
  useLiveChanges(["activity", "devices"], load);

  function older() {
    const last = entries?.[entries.length - 1];
    if (!last) return;
    void api.activity({ kind: kind || undefined, deviceId, before: last.at, limit: pageSize }).then((r) => {
      setEntries((list) => [...(list ?? []), ...r.entries]);
      setMore(r.entries.length === pageSize);
    });
  }

  let lastDay = "";
  return (
    <Stack spacing={1.5}>
      {showFilters ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap role="group" aria-label="Show">
          <Chip label="Everything" clickable color={kind === "" ? "primary" : "default"} variant={kind === "" ? "filled" : "outlined"} onClick={() => setKind("")} />
          {(Object.keys(KIND) as ActivityKind[]).map((k) => (
            <Chip key={k} label={KIND[k].label} clickable color={kind === k ? "primary" : "default"} variant={kind === k ? "filled" : "outlined"} onClick={() => setKind(k)} />
          ))}
        </Stack>
      ) : null}
      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}
      {entries && !entries.length ? (
        <Typography variant="body2" color="text.secondary">
          Nothing recorded yet.
        </Typography>
      ) : null}
      <Box>
        {entries?.map((e, n) => {
          const day = dayLabel(e.at);
          const head = day !== lastDay;
          lastDay = day;
          const Icon = KIND[e.kind]?.icon ?? SettingsSuggestRoundedIcon;
          return (
            <Box key={`${e.at}-${n}`}>
              {head ? (
                <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: n ? 1.5 : 0, mb: 0.5 }}>
                  {day}
                </Typography>
              ) : null}
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 0.75, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="body2" color="text.secondary" sx={{ width: 64, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </Typography>
                <Icon sx={{ fontSize: ICON_SIZE.title, color: BAD.test(e.text) ? "warning.main" : "primary.main", flexShrink: 0, mt: "1px" }} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} color={BAD.test(e.text) ? "warning.main" : "text.primary"}>
                  {e.text}
                  {e.who ? (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {" "}— by {e.who}
                    </Typography>
                  ) : null}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {more ? (
        <Button variant="outlined" onClick={older} sx={{ alignSelf: "flex-start" }}>
          Show older
        </Button>
      ) : null}
    </Stack>
  );
}
