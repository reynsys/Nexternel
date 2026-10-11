import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { weatherKind, type WeatherKind } from "./weather-icons";

type MarkProps = {
  size: string;
};

function IconFrame({ size, children, label }: MarkProps & { children: ReactNode; label: string }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      sx={{ width: size, height: size, flexShrink: 0, display: "block" }}
    >
      {children}
    </Box>
  );
}

function Sun({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      {rays.map((deg) => {
        const a = (deg * Math.PI) / 180;
        const inner = r + 1.2;
        const outer = r + 3;
        return (
          <line
            key={deg}
            x1={cx + Math.cos(a) * inner}
            y1={cy + Math.sin(a) * inner}
            x2={cx + Math.cos(a) * outer}
            y2={cy + Math.sin(a) * outer}
            stroke={color}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

function Cloud({ color, x = 0, y = 0 }: { color: string; x?: number; y?: number }) {
  return <path fill={color} transform={`translate(${x} ${y})`} d="M6.2 16.2h9.4a3.2 3.2 0 0 0 .2-6.4 4.6 4.6 0 0 0-8.8-1.1 3 3 0 0 0-.8 7.5z" />;
}

function Drops({ color, y }: { color: string; y: number }) {
  return (
    <g fill={color}>
      <path d={`M8 ${y}c0 1.3-.9 2.2-.9 2.2S6.2 ${y + 1.3} 6.2 ${y}a.9.9 0 0 1 1.8 0z`} />
      <path d={`M12.4 ${y + 0.6}c0 1.3-.9 2.2-.9 2.2s-.9-.9-.9-2.2a.9.9 0 0 1 1.8 0z`} />
      <path d={`M16.8 ${y}c0 1.3-.9 2.2-.9 2.2s-.9-.9-.9-2.2a.9.9 0 0 1 1.8 0z`} />
    </g>
  );
}

function Drawing({ kind }: { kind: WeatherKind }) {
  const theme = useTheme();
  const sun = theme.palette.warning.main;
  const cloud = theme.palette.text.secondary;
  const rain = theme.palette.primary.main;
  const snow = theme.palette.info.main;

  if (kind === "clear") return <Sun cx={12} cy={12} r={4} color={sun} />;
  if (kind === "partly") {
    return (
      <g>
        <Sun cx={15.5} cy={8} r={2.4} color={sun} />
        <Cloud color={cloud} y={2} />
      </g>
    );
  }
  if (kind === "cloudy") return <Cloud color={cloud} y={1} />;
  if (kind === "fog") {
    return (
      <g stroke={cloud} strokeWidth="1.7" strokeLinecap="round">
        <line x1="5" y1="8" x2="19" y2="8" />
        <line x1="7" y1="12" x2="17" y2="12" />
        <line x1="5" y1="16" x2="19" y2="16" />
      </g>
    );
  }
  if (kind === "drizzle") {
    return (
      <g>
        <Cloud color={cloud} y={-2} />
        <Drops color={rain} y={16.5} />
      </g>
    );
  }
  if (kind === "rain" || kind === "showers") {
    return (
      <g>
        <Cloud color={cloud} y={-2} />
        <Drops color={rain} y={16.2} />
      </g>
    );
  }
  if (kind === "snow") {
    return (
      <g>
        <Cloud color={cloud} y={-2} />
        <g fill={snow}>
          <circle cx="8" cy="18" r="1.1" />
          <circle cx="12" cy="19.2" r="1.1" />
          <circle cx="16" cy="18" r="1.1" />
        </g>
      </g>
    );
  }
  return (
    <g>
      <Cloud color={cloud} y={-2} />
      <path d="M13 15.2l-2.2 3.4h2l-1.2 3.2 3.4-4h-2.1z" fill={sun} />
    </g>
  );
}

/** A weather drawing. The same shape on every screen, sized from the tile. */
export function WeatherIcon({ code, size }: { code: number; size: string }) {
  const kind = weatherKind(code);
  return (
    <IconFrame size={size} label={kind}>
      <Drawing kind={kind} />
    </IconFrame>
  );
}

export function HumidityMark({ size }: MarkProps) {
  const theme = useTheme();
  return (
    <IconFrame size={size} label="Humidity">
      <path
        d="M12 4.5c2.8 3.6 5 6.4 5 9.2a5 5 0 0 1-10 0c0-2.8 2.2-5.6 5-9.2z"
        fill={theme.palette.primary.main}
      />
    </IconFrame>
  );
}

export function WindMark({ size }: MarkProps) {
  const theme = useTheme();
  const color = theme.palette.text.secondary;
  return (
    <IconFrame size={size} label="Wind">
      <g fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round">
        <path d="M4 9h10a2 2 0 1 0-2-2" />
        <path d="M4 13h13a2 2 0 1 1-2 2" />
        <path d="M4 17h7" />
      </g>
    </IconFrame>
  );
}
