import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Box, Button, Card, CardContent, Divider, Stack, Tab, Tabs, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorRoundedIcon from "@mui/icons-material/ErrorRounded";
import { api, type SystemInfo } from "../../../api";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { SystemDiagnosticsSection } from "./SystemDiagnosticsSection";
import { DiagnosticReportCard } from "./DiagnosticReportCard";
import { UpdatesCard } from "./UpdatesCard";
import { HttpsCard } from "./HttpsCard";
import { AnywhereCard } from "./AnywhereCard";
import { HomeNameCard } from "./HomeNameCard";
import { DevicesWifiCard } from "./DevicesWifiCard";
import { ButtonRow } from "../../../components/ButtonRow";
import { ActivityList } from "../../../components/ActivityList";
import { hasPermission } from "../../../lib/permissions";
import { useShellAuth } from "../../../skins/useShellAuth";

/** The System page's tabs; the open one is in the address (?tab=…), so links and Back work. */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "addresses", label: "Addresses" },
  { id: "activity", label: "Activity" },
  { id: "help", label: "Help & troubleshooting" },
] as const;
type SystemTab = (typeof TABS)[number]["id"];

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

const gb = (mb: number) => (mb / 1024).toFixed(1);

/** One plain sentence about whether everything is running, and what to do if not. */
function healthLine(info: SystemInfo): { ok: boolean; title: string; text: string } {
  const db = info.database === "ok";
  const mqtt = info.mqtt === "connected";
  if (db && mqtt) {
    return { ok: true, title: "Everything is running", text: `The server, its database and device messages are working. Running for ${formatUptime(info.uptimeSeconds)}.` };
  }
  const problems = [!db ? "the database is not answering" : null, !mqtt ? "device messages (MQTT) are not connected — readings and switches will not update" : null].filter(Boolean);
  return {
    ok: false,
    title: "Something needs attention",
    text: `${problems.join("; ")}${info.mqttError ? ` (${info.mqttError})` : ""}. Try Restart on the Help & troubleshooting tab.`,
  };
}

/**
 * Settings → System, in tabs so it is not one long page: Overview (the home's name, health, version and updates),
 * Addresses (how to open Nexternel, at home and with Nexternel Anywhere), Activity (what happened),
 * Help & troubleshooting.
 */
export function SystemStatusPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const { permissions, isAdmin } = useShellAuth();
  const canSeeActivity = hasPermission(permissions ?? null, "viewDevices", Boolean(isAdmin));
  const tabs = TABS.filter((t) => t.id !== "activity" || canSeeActivity);
  // Old links to the Anywhere card (…/system#nexternel-anywhere) open the Addresses tab.
  const asked = (params.get("tab") ?? (window.location.hash === "#nexternel-anywhere" ? "addresses" : "overview")) as SystemTab;
  const tab: SystemTab = tabs.some((t) => t.id === asked) ? asked : "overview";
  const openTab = (id: SystemTab) => setParams(id === "overview" ? {} : { tab: id }, { replace: true });
  const [restartBusy, setRestartBusy] = useState<"all" | "mqtt" | null>(null);
  const [restartMsg, setRestartMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const surfaceSx = useContentSurfaceSx();

  useEffect(() => {
    void api
      .system()
      .then(setInfo)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the system information"));
  }, []);

  async function restart(service: "all" | "mqtt") {
    setRestartBusy(service);
    setRestartMsg(null);
    try {
      const result = await api.restartServices(service);
      setRestartMsg({ ok: true, text: result.message });
      setInfo(await api.system());
    } catch (err) {
      setRestartMsg({ ok: false, text: err instanceof Error ? err.message : "Restart failed" });
    } finally {
      setRestartBusy(null);
    }
  }

  const health = info ? healthLine(info) : null;

  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, v: SystemTab) => openTab(v)} variant="scrollable" allowScrollButtonsMobile aria-label="System">
        {tabs.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>

      {tab === "addresses" ? (
        <>
          <HttpsCard />
          <AnywhereCard />
        </>
      ) : null}

      {tab === "activity" ? (
        <Card sx={surfaceSx}>
          <CardContent>
            <ActivityList />
          </CardContent>
        </Card>
      ) : null}

      {tab === "overview" ? (
      <>
      <HomeNameCard surfaceSx={surfaceSx} canEdit={Boolean(isAdmin)} />
      <DevicesWifiCard surfaceSx={surfaceSx} canEdit={Boolean(isAdmin)} />
      <Card sx={surfaceSx}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Health
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {info && health ? (
            <Stack spacing={2}>
              <Alert
                severity={health.ok ? "success" : "warning"}
                icon={health.ok ? <CheckCircleRoundedIcon /> : <ErrorRoundedIcon />}
                action={
                  !health.ok ? (
                    <Button color="inherit" size="small" onClick={() => openTab("help")}>
                      Help
                    </Button>
                  ) : undefined
                }
              >
                <Typography fontWeight="fontWeightBold">{health.title}</Typography>
                <Typography variant="body2">{health.text}</Typography>
              </Alert>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2">Computer</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {info.cpu.model} · {info.cpu.cores} cores · busy {info.cpu.loadPercent}%
                    {info.temperatureC != null ? ` · ${Math.round(info.temperatureC)}°C` : ""}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Memory</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {gb(info.memory.usedMb)} of {gb(info.memory.totalMb)} GB in use
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Network</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Home address {info.lanIp ?? "—"}
                    {info.wanIp ? ` · internet address ${info.wanIp}` : ""}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">Version</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nexternel {info.version}
                  </Typography>
                </Box>
              </Box>
            </Stack>
          ) : null}
        </CardContent>
      </Card>

      <UpdatesCard />
      </>
      ) : null}

      {tab === "help" ? (
      <Card sx={surfaceSx}>
        <CardContent>
          <Typography variant="h6">Help &amp; troubleshooting</Typography>
          <Typography variant="body2" color="text.secondary">
            Tools for when something is not working, or when someone is helping you.
          </Typography>
            <Stack spacing={3} divider={<Divider flexItem />} sx={{ pt: 3 }}>
              <DiagnosticReportCard />
              <SystemDiagnosticsSection />
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Restart
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Restart Nexternel, or only the service that carries device messages (MQTT). Dashboards come back by themselves after a few
                  seconds.
                </Typography>
                <ButtonRow direction="row">
                  <Button variant="outlined" disabled={restartBusy !== null} onClick={() => void restart("all")}>
                    {restartBusy === "all" ? "Restarting…" : "Restart Nexternel"}
                  </Button>
                  <Button variant="outlined" disabled={restartBusy !== null} onClick={() => void restart("mqtt")}>
                    {restartBusy === "mqtt" ? "Restarting…" : "Restart messaging"}
                  </Button>
                </ButtonRow>
                {restartMsg ? (
                  <Alert severity={restartMsg.ok ? "success" : "error"} sx={{ mt: 1.5 }} onClose={() => setRestartMsg(null)}>
                    {restartMsg.text}
                  </Alert>
                ) : null}
              </Box>
            </Stack>
        </CardContent>
      </Card>
      ) : null}
    </Stack>
  );
}
