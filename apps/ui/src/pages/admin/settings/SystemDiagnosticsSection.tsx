import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import {
  api,
  type DevicePipelineDiagnostic,
  type LivePipelineDiagnostics,
  type PipelineStageStatus,
} from "../../../api";
import { connectivityChipColor, connectivityLabel, deviceConnectivityState } from "../../../lib/device-utils";
import { ButtonRow } from "../../../components/ButtonRow";

function stageColor(status: PipelineStageStatus): "success" | "error" | "warning" | "default" {
  if (status === "pass") return "success";
  if (status === "fail") return "error";
  if (status === "warn") return "warning";
  return "default";
}

function DeviceRow({ device }: { device: DevicePipelineDiagnostic }) {
  const [open, setOpen] = useState(false);
  const connectivity = deviceConnectivityState(device);
  return (
    <>
      <TableRow hover sx={{ cursor: "pointer" }} onClick={() => setOpen((v) => !v)}>
        <TableCell>{device.name}</TableCell>
        <TableCell>{device.protocol}</TableCell>
        <TableCell>{device.mqttTopicPrefix}</TableCell>
        <TableCell>
          <Chip
            size="small"
            label={connectivityLabel(connectivity)}
            color={connectivityChipColor(connectivity)}
          />
        </TableCell>
        <TableCell>{device.messagesObserved}</TableCell>
        <TableCell>
          {device.breakAt ? (
            <Chip size="small" color="error" label={device.breakAt} />
          ) : (
            <Chip size="small" color="success" label="ok" />
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0, borderBottom: open ? undefined : 0 }}>
          <Collapse in={open}>
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {device.summary}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                {device.pipeline.map((stage) => (
                  <Chip
                    key={stage.id}
                    size="small"
                    color={stageColor(stage.status)}
                    label={`${stage.label}: ${stage.status}`}
                    title={stage.detail}
                  />
                ))}
              </Stack>
              {device.lastObservedMessage && (
                <Typography variant="caption" display="block">
                  Last message: {device.lastObservedMessage.topic} @ {device.lastObservedMessage.at}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function SystemDiagnosticsSection() {
  const [report, setReport] = useState<LivePipelineDiagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sniffMsg, setSniffMsg] = useState<string | null>(null);

  async function loadPipeline() {
    setBusy(true);
    setError(null);
    try {
      const data = await api.diagnosticsPipeline();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagnostics");
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  async function startSniff() {
    setSniffMsg(null);
    setError(null);
    try {
      const result = await api.diagnosticsMqttSniff(30_000);
      setSniffMsg(result.message);
      window.setTimeout(() => {
        void loadPipeline();
      }, 31_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broker sniff failed");
    }
  }

  return (
    <Box>
        <Typography variant="subtitle1" gutterBottom>
          Check device messages
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Shows whether each device's messages reach Nexternel and turn into readings. Only looks — changes nothing.
        </Typography>
        <ButtonRow direction="row" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <Button variant="contained" disabled={busy} onClick={() => void loadPipeline()}>
            {busy ? "Checking…" : "Run the check"}
          </Button>
          <Button variant="outlined" disabled={busy} onClick={() => void startSniff()}>
            Watch all messages for 30 s
          </Button>
        </ButtonRow>
        {sniffMsg && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {sniffMsg} — diagnostics will refresh when the sniff window ends.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {report && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`MQTT ${String(report.mqtt.status)}`} />
              <Chip label={`${report.summary.devicesWithTraffic}/${report.summary.devicesTotal} with traffic`} />
              <Chip
                label={`${report.summary.devicesWithoutTraffic} no traffic`}
                color={report.summary.devicesWithoutTraffic > 0 ? "warning" : "default"}
              />
              <Chip label={`${report.summary.unmatchedMessageCount} unmatched topics`} />
            </Stack>
            <Typography variant="subtitle2">By protocol</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {Object.entries(report.byProtocol).map(([key, val]) => (
                <Chip
                  key={key}
                  variant="outlined"
                  label={`${key}: ${val.withTraffic}/${val.count} traffic`}
                />
              ))}
            </Stack>
            {report.recentUnmatchedTopics.length > 0 && (
              <>
                <Typography variant="subtitle2">Recent unmatched MQTT topics</Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Messages received by the API that did not match a capability binding.
                </Typography>
                {report.recentUnmatchedTopics.slice(0, 10).map((m) => (
                  <Typography key={`${m.topic}-${m.at}`} variant="caption" display="block">
                    {m.at} — {m.topic}
                  </Typography>
                ))}
              </>
            )}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>Protocol</TableCell>
                  <TableCell>MQTT prefix</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Msgs</TableCell>
                  <TableCell>Break at</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {report.devices.map((d) => (
                  <DeviceRow key={d.deviceId} device={d} />
                ))}
              </TableBody>
            </Table>
          </Stack>
        )}
    </Box>
  );
}
