import { useEffect, useState } from "react";
import { Stack, Typography } from "@mui/material";
import { api, type DeviceConnection } from "../../../api";

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? clock(iso) : `${d.toLocaleDateString([], { weekday: "short" })} ${clock(iso)}`;
};
const minutes = (m: number) => (m < 1 ? "under a minute" : m >= 120 ? `${Math.round(m / 60)} hours` : `${m} min`);

/**
 * When the device was online and offline in the last 24 hours (Nexternel records every change).
 * `refresh` changes when the device's state may have changed.
 */
export function ConnectionHistory({ deviceId, refresh }: { deviceId: string; refresh?: unknown }) {
  const [c, setC] = useState<DeviceConnection | null>(null);
  useEffect(() => {
    let cancelled = false;
    void api
      .deviceConnection(deviceId)
      .then((r) => !cancelled && setC(r.connection))
      .catch(() => !cancelled && setC(null));
    return () => {
      cancelled = true;
    };
  }, [deviceId, refresh]);
  if (!c) return null;

  const now = c.since ? `${c.state === "offline" ? "Offline" : "Online"} since ${day(c.since)}.` : null;
  const shown = c.outages.slice(0, 5);
  return (
    <Stack spacing={0.25} sx={{ mt: 1 }}>
      {now ? (
        <Typography variant="body2" color={c.state === "offline" ? "warning.main" : "text.secondary"}>
          {now}
        </Typography>
      ) : null}
      {c.wifiDbm !== null || c.restartedAt ? (
        <Typography variant="body2" color={c.wifiQuality === "weak" || c.wifiQuality === "very weak" ? "warning.main" : "text.secondary"}>
          {[
            c.wifiDbm !== null ? `Wi-Fi signal ${c.wifiQuality} (${c.wifiDbm} dBm)` : null,
            c.restartedAt ? `last restarted ${day(c.restartedAt)}` : null,
            c.restarts ? `${c.restarts === 1 ? "1 restart" : `${c.restarts} restarts`} in the last 24 hours` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          .
        </Typography>
      ) : null}
      <Typography variant="body2" color="text.secondary">
        {c.outages.length
          ? `Dropped out ${c.outages.length === 1 ? "once" : `${c.outages.length} times`} in the last 24 hours (longest ${minutes(c.longestMinutes)}):`
          : "No drop-outs in the last 24 hours."}
      </Typography>
      {shown.map((o) => (
        <Typography key={o.from} variant="caption" color="text.secondary" sx={{ pl: 1.5 }}>
          {day(o.from)} – {o.to ? clock(o.to) : "now"} · {minutes(o.minutes)}
        </Typography>
      ))}
      {c.outages.length > shown.length ? (
        <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5 }}>
          and {c.outages.length - shown.length} more
        </Typography>
      ) : null}
    </Stack>
  );
}
