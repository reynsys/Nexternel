import { useEffect, useState } from "react";

import {

  Alert,

  Button,

  Card,

  CardContent,

  Chip,

  Link,

  Stack,

  Typography,

} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { api, type SystemInfo } from "../../../api";

import { useSkin } from "../../../skins/SkinProvider";

import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { SystemDiagnosticsSection } from "./SystemDiagnosticsSection";
import { DiagnosticReportCard } from "./DiagnosticReportCard";
import { UpdatesCard } from "./UpdatesCard";



function formatUptime(sec: number): string {

  const d = Math.floor(sec / 86400);

  const h = Math.floor((sec % 86400) / 3600);

  const m = Math.floor((sec % 3600) / 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;

  if (h > 0) return `${h}h ${m}m`;

  return `${m}m`;

}



type RestartService = "all" | "mqtt" | "api";



const RESTART_OPTIONS: { id: RestartService; label: string }[] = [

  { id: "all", label: "Restart Nexternel services" },

  { id: "mqtt", label: "Restart MQTT" },

];



export function SystemStatusPage() {

  const [info, setInfo] = useState<SystemInfo | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [restartBusy, setRestartBusy] = useState<RestartService | null>(null);
  const [restartMsg, setRestartMsg] = useState<string | null>(null);

  const [restartErr, setRestartErr] = useState<string | null>(null);

  const { skin } = useSkin();

  const surfaceSx = useContentSurfaceSx();



  useEffect(() => {

    void api

      .system()

      .then(setInfo)

      .catch((err) =>

        setError(err instanceof Error ? err.message : "Failed to load system info")

      );

  }, []);



  async function onRestartServices(service: RestartService) {

    setRestartBusy(service);

    setRestartMsg(null);

    setRestartErr(null);

    try {

      const result = await api.restartServices(service);

      setRestartMsg(result.message);

      const fresh = await api.system();

      setInfo(fresh);

    } catch (err) {

      setRestartErr(err instanceof Error ? err.message : "Restart failed");

    } finally {

      setRestartBusy(null);

    }

  }



  if (error) {

    return <Alert severity="error">{error}</Alert>;

  }



  if (!info) {

    return null;

  }



  return (

    <Stack spacing={2}>

      <UpdatesCard />

      <Card sx={surfaceSx}>

        <CardContent>

          <Typography variant="h6" gutterBottom>

            Service status

          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>

            <Chip label={`API ${info.version}`} color="primary" />

            <Chip

              label={`DB ${info.database}`}

              color={info.database === "ok" ? "success" : "error"}

            />

            <Chip

              label={`MQTT ${info.mqtt}`}

              color={info.mqtt === "connected" ? "success" : "warning"}

            />

            <Chip label={`Uptime ${formatUptime(info.uptimeSeconds)}`} />

            <Chip label={`Skin ${skin.id}`} variant="outlined" />

          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>

            {RESTART_OPTIONS.map((opt) => (

              <Button

                key={opt.id}

                variant="outlined"

                size="small"

                disabled={restartBusy !== null}

                onClick={() => void onRestartServices(opt.id)}

              >

                {restartBusy === opt.id ? "Restarting…" : opt.label}

              </Button>

            ))}

          </Stack>

          {restartMsg && (

            <Alert severity="success" sx={{ mt: 1 }}>

              {restartMsg}

            </Alert>

          )}

          {restartErr && (

            <Alert severity="error" sx={{ mt: 1 }}>

              {restartErr}

            </Alert>

          )}

        </CardContent>

      </Card>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>

        <Card sx={{ flex: 1, ...surfaceSx }}>

          <CardContent>

            <Typography variant="h6" gutterBottom>

              Host

            </Typography>

            <Typography variant="body2">CPU: {info.cpu.model}</Typography>

            <Typography variant="body2">

              Cores: {info.cpu.cores} · Load: {info.cpu.loadPercent}%

            </Typography>

            <Typography variant="body2">

              Memory: {info.memory.usedMb} / {info.memory.totalMb} MB

            </Typography>

          </CardContent>

        </Card>

        <Card sx={{ flex: 1, ...surfaceSx }}>

          <CardContent>

            <Typography variant="h6" gutterBottom>

              Network

            </Typography>

            <Typography variant="body2">LAN: {info.lanIp ?? "—"}</Typography>

            <Typography variant="body2">WAN: {info.wanIp ?? "—"}</Typography>

            {info.mqttError && (
              <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                MQTT error: {info.mqttError}
              </Typography>
            )}
            {info.mqtt !== "connected" && (
              <Typography variant="body2" color="text.secondary">
                Try{" "}
                <Link component={RouterLink} to="/admin/settings/advanced">
                  Settings → Advanced
                </Link>{" "}
                → Repair MQTT connection.
              </Typography>
            )}

          </CardContent>

        </Card>

      </Stack>

      <SystemDiagnosticsSection />
      <DiagnosticReportCard />

    </Stack>

  );

}


