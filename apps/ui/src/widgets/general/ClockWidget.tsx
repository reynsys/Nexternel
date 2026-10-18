import { useEffect, useState } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import type { WidgetInstance } from "../../api";
import { widgetTitleOr } from "./config";
import { parseClockConfig, type ClockConfig } from "./clock-config";
import { panelContentRootSx } from "../../components/DashboardTileBody";
import { useDashboardTileChrome } from "../../lib/dashboard-tile-context";

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function AnalogFace({ now, clock, fontFamily }: { now: Date; clock: ClockConfig; fontFamily: string }) {
  const theme = useTheme();
  const ink = clock.color === "accent" ? theme.palette.primary.main : theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const line = theme.palette.divider;
  const accent = theme.palette.primary.main;
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourDeg = h * 30 + m * 0.5;
  const minuteDeg = m * 6 + s * 0.1;
  const secondDeg = s * 6;
  const roman = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  const minimal = clock.dial === "minimal";
  const weight = clock.bold ? 700 : 400;

  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <circle cx="60" cy="60" r="56" fill="none" stroke={line} strokeWidth={minimal ? 1 : clock.dial === "roman" ? 2.5 : 2} />
      {clock.dial !== "roman" &&
        Array.from({ length: 12 }, (_, i) => {
          const angle = (i * Math.PI) / 6;
          const outer = 52;
          const inner = minimal ? 48 : i % 3 === 0 ? 44 : 47;
          return (
            <line
              key={i}
              x1={60 + Math.sin(angle) * inner}
              y1={60 - Math.cos(angle) * inner}
              x2={60 + Math.sin(angle) * outer}
              y2={60 - Math.cos(angle) * outer}
              stroke={muted}
              strokeWidth={minimal ? 1 : i % 3 === 0 ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}
      {clock.dial === "roman" &&
        roman.map((label, i) => {
          const angle = (i * Math.PI) / 6;
          return (
            <text
              key={label}
              x={60 + Math.sin(angle) * 40}
              y={60 - Math.cos(angle) * 40}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={muted}
              fontSize="8"
              fontFamily={fontFamily}
              fontWeight={weight}
              fontStyle={clock.italic ? "italic" : "normal"}
            >
              {label}
            </text>
          );
        })}
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="36"
        stroke={ink}
        strokeWidth={minimal ? 2.5 : 3.5}
        strokeLinecap="round"
        transform={`rotate(${hourDeg} 60 60)`}
      />
      <line
        x1="60"
        y1="60"
        x2="60"
        y2="24"
        stroke={ink}
        strokeWidth={minimal ? 1.5 : 2}
        strokeLinecap="round"
        transform={`rotate(${minuteDeg} 60 60)`}
      />
      {!minimal && (
        <line
          x1="60"
          y1="66"
          x2="60"
          y2="18"
          stroke={accent}
          strokeWidth="1"
          strokeLinecap="round"
          transform={`rotate(${secondDeg} 60 60)`}
        />
      )}
      <circle cx="60" cy="60" r={minimal ? 2 : 3} fill={accent} />
    </svg>
  );
}

function DigitalFace({
  now,
  clock,
  fontFamily,
}: {
  now: Date;
  clock: ClockConfig;
  fontFamily: string;
}) {
  const theme = useTheme();
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fill = clock.color === "accent" ? theme.palette.primary.main : theme.palette.text.primary;
  const weight = clock.bold ? 700 : 400;

  return (
    <svg viewBox="0 0 440 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <text
        x="220"
        y="68"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={fill}
        fontSize="56"
        fontFamily={fontFamily}
        fontWeight={weight}
        fontStyle={clock.italic ? "italic" : "normal"}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {time}
      </text>
      <text
        x="220"
        y="122"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={theme.palette.text.secondary}
        fontSize="22"
        fontFamily={fontFamily}
        fontWeight={clock.bold ? 600 : 400}
        fontStyle={clock.italic ? "italic" : "normal"}
      >
        {date}
      </text>
    </svg>
  );
}

export function ClockWidget({ widget }: { widget: WidgetInstance }) {
  const now = useNow();
  const theme = useTheme();
  const { showBodyHeading } = useDashboardTileChrome();
  const title = showBodyHeading ? widgetTitleOr(widget, "Clock") : undefined;
  const clock = parseClockConfig(widget.config);
  const fontFamily = String(theme.typography.fontFamily);

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {title && (
        <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ mb: 0.5, flexShrink: 0 }}>
          {title}
        </Typography>
      )}
      <Box sx={panelContentRootSx({ alignItems: "center", justifyContent: "center" })}>
        {clock.face === "analog" ? (
          <AnalogFace now={now} clock={clock} fontFamily={fontFamily} />
        ) : (
          <DigitalFace now={now} clock={clock} fontFamily={fontFamily} />
        )}
      </Box>
    </Box>
  );
}
