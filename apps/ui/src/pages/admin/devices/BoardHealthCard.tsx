import { useEffect, useState } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import MonitorHeartRoundedIcon from "@mui/icons-material/MonitorHeartRounded";
import { api, type BoardHealthReport, type DeviceRecord } from "../../../api";
import { InfoCard, durationWords, shortWhen } from "./DeviceBits";
import { devicesOutlinedButton } from "./devices-panel-styles";

/** "3 days 4 hours", "2 hours 5 min", "4 min". */
function uptimeWords(s: number): string {
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"}`;
  if (h) return `${h} hour${h === 1 ? "" : "s"} ${m} min`;
  return durationWords(m);
}

const kb = (b: number | null) => (b === null ? "—" : `${Math.round(b / 1024)} KB`);

/**
 * Troubleshooting → Board health: the board's last health report (sent every minute) — how long it has
 * been running and why it last restarted, Wi‑Fi, how often Wi‑Fi and the message service dropped since
 * then, free memory — and Check now, which asks the board for a fresh report straight away.
 */
export function BoardHealthCard({ device, report: initial }: { device: DeviceRecord; report: BoardHealthReport | null }) {
  const [report, setReport] = useState<BoardHealthReport | null>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setReport(initial), [initial]);

  async function check() {
    setBusy(true);
    setNote(null);
    try {
      const r = await api.checkDeviceHealth(device.id);
      if (r.report) {
        setReport(r.report);
        setNote({ ok: true, text: "The board answered straight away." });
      } else setNote({ ok: false, text: "The board did not answer within 10 seconds. It may be offline, or still on software without the health report (update it once)." });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "Could not ask the board" });
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string, boolean?][] = report
    ? [
        ["Running for", uptimeWords(report.uptimeS)],
        ["Last restart", report.resetReason ?? "Not known", /power|crash|watchdog|frozen|locked|glitch/i.test(report.resetReason ?? "")],
        ["Wi‑Fi signal", report.rssi !== null ? `${report.rssi} dBm` : "—"],
        ["Wi‑Fi drops since restart", report.wifiDrops !== null ? String(report.wifiDrops) : "—", (report.wifiDrops ?? 0) > 2],
        ["Message service drops since restart", report.mqttDrops !== null ? String(report.mqttDrops) : "—", (report.mqttDrops ?? 0) > 2],
        ["Free memory (lowest)", `${kb(report.heap)}${report.heapMin !== null ? ` (${kb(report.heapMin)})` : ""}`],
        ["Software", report.version ? `ESPHome ${report.version}` : "—"],
      ]
    : [];

  return (
    <InfoCard
      title="Board health"
      action={
        <Button {...devicesOutlinedButton} startIcon={<MonitorHeartRoundedIcon />} disabled={busy} onClick={() => void check()}>
          {busy ? "Asking the board…" : "Check now"}
        </Button>
      }
    >
      {report ? (
        <>
          <Typography variant="caption" color="text.secondary">
            Last report: {shortWhen(report.at)} · the board sends one every minute
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            {rows.map(([label, value, warn]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {label}
                </Typography>
                <Typography variant="body2" color={warn ? "warning.main" : "text.primary"}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No health report yet. Boards send one every minute once they run the current software (Overview → Update board); Check now asks for one straight away.
        </Typography>
      )}
      {note ? <Alert severity={note.ok ? "success" : "warning"}>{note.text}</Alert> : null}
    </InfoCard>
  );
}
