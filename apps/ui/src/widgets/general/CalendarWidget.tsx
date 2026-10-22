import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import type { WidgetInstance } from "../../api";
import { calendarTitleLabel } from "../../lib/panel-heading";
import { genericTileFitLinesSize, genericTileLinesQuerySx } from "./tile-type";
import { panelContentRootSx } from "../../components/DashboardTileBody";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function CalendarWidget({ widget: _widget }: { widget: WidgetInstance }) {
  const now = useNow(60_000);
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDayJs = new Date(year, month, 1).getDay();
  const firstDay = (firstDayJs + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = calendarTitleLabel(now);
  const weekDays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const weeks = Math.ceil(cells.length / 7);

  const { showBodyHeading } = useDashboardTileChrome();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      {showBodyHeading && (
        <Typography variant="subtitle2" color="text.primary" noWrap sx={{ mb: 1, flexShrink: 0 }}>
          {monthName}
        </Typography>
      )}
      <Box
        sx={panelContentRootSx({
          p: 1,
          // The month fits its tile: day names plus the weeks, sized by width and height.
          ...genericTileLinesQuerySx,
          "--nx-cal-font": genericTileFitLinesSize(1 + weeks, { reservedPx: weeks * 2, widthCqi: 3.6, max: "2.25rem" }),
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridTemplateRows: `auto repeat(${weeks}, minmax(min-content, 1fr))`, // rows never squeeze text; scrolls when short of room
          gap: 0.25,
          textAlign: "center",
        })}
      >
        {weekDays.map((d) => (
          <Typography
            key={d}
            variant="caption"
            color="primary.main"
            sx={{ fontSize: "var(--nx-cal-font)", fontWeight: "fontWeightBold", lineHeight: 1.2 }}
          >
            {d}
          </Typography>
        ))}
        {cells.map((day, i) => (
          <Box
            key={i}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 0.5,
              fontSize: "var(--nx-cal-font)",
              fontWeight: day === today ? 700 : 400,
              bgcolor: day === today ? "primary.main" : "transparent",
              color: day === today ? "primary.contrastText" : "text.primary",
            }}
          >
            {day ?? ""}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
