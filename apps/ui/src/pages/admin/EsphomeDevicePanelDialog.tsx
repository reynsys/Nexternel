import { CODE_TEXT } from "../../lib/appearance/type";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import { api, type DeviceRecord, type EsphomeBuildPrerequisites } from "../../api";
import { esphomeDashboardUrl } from "../../lib/device-utils";
import {
  ESPHOME_INSTALL_STEPS,
  ESPHOME_INSTALL_WORKFLOW_TITLE,
  ESPHOME_USB_INSTALL_STEPS,
  ESPHOME_WEB_INSTALLER_URL,
  ESPHOME_WRONG_FLASH_RECOVERY,
  esphomeInstallActiveStep,
  summarizeEsphomeCompileLog,
  summarizeEsphomeUploadLog,
} from "../../lib/esphome-install-guide";
import { ButtonRow } from "../../components/ButtonRow";

type Props = {
  open: boolean;
  device: DeviceRecord | null;
  hostname: string;
  busy: boolean;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
  onUpdated: () => void;
};

type ActionKind = "compile" | "upload" | null;

export function EsphomeDevicePanelDialog({
  open,
  device,
  hostname,
  busy,
  onClose,
  onBusy,
  onError,
  onSuccess,
  onUpdated,
}: Props) {
  const [tab, setTab] = useState(0);
  const [rawLog, setRawLog] = useState("");
  const [lastAction, setLastAction] = useState<ActionKind>(null);
  const [showTechnicalLog, setShowTechnicalLog] = useState(false);
  const [showOtaSection, setShowOtaSection] = useState(false);
  const [usbGuideOpen, setUsbGuideOpen] = useState(false);
  const [yaml, setYaml] = useState("");
  const [yamlPath, setYamlPath] = useState("");
  const [managementMode, setManagementMode] = useState<string | null>(null);
  const [lastCompileOk, setLastCompileOk] = useState<boolean | null>(null);
  const [buildPrerequisites, setBuildPrerequisites] =
    useState<EsphomeBuildPrerequisites | null>(null);

  const lifecycle = device?.esphomeLifecycleState ?? null;
  const dashboardUrl = device
    ? esphomeDashboardUrl(hostname, device.esphomeName || device.slug)
    : esphomeDashboardUrl(hostname);

  const logSummary = useMemo(() => {
    if (!rawLog) return null;
    if (lastAction === "upload") return summarizeEsphomeUploadLog(rawLog);
    return summarizeEsphomeCompileLog(rawLog);
  }, [rawLog, lastAction]);

  const compileSucceeded =
    lastCompileOk === true ||
    (lastAction === "compile" && logSummary?.ok === true);
  const serverFirmwareReady =
    lifecycle === "firmware_ready" ||
    lifecycle === "connecting" ||
    lifecycle === "online";
  const canDownloadFirmware = compileSucceeded || serverFirmwareReady;
  const activeStep = Math.max(
    esphomeInstallActiveStep(lifecycle),
    compileSucceeded || serverFirmwareReady ? 2 : 0
  );

  useEffect(() => {
    if (!open) {
      setBuildPrerequisites(null);
      return;
    }
    void api
      .esphomeBuildPrerequisites()
      .then(setBuildPrerequisites)
      .catch(() => setBuildPrerequisites(null));
  }, [open]);

  useEffect(() => {
    if (!open || !device) return;
    setTab(0);
    setRawLog("");
    setLastAction(null);
    setShowTechnicalLog(false);
    setShowOtaSection(false);
    setUsbGuideOpen(false);
    setYaml("");
    setYamlPath("");
    setLastCompileOk(null);
    void api
      .esphomeDeviceYaml(device.id)
      .then((res) => {
        setYaml(res.yaml);
        setYamlPath(res.path);
        setManagementMode(res.managementMode ?? device.esphomeManagementMode ?? null);
      })
      .catch(() => {
        setYaml("");
      });
  }, [open, device?.id]);

  useEffect(() => {
    if (!device) return;
    setManagementMode(device.esphomeManagementMode ?? null);
  }, [device?.esphomeManagementMode, device?.esphomeLifecycleState]);

  async function runCompile() {
    if (!device) return;
    onBusy(true);
    onError(null);
    setLastAction("compile");
    setRawLog("Building firmware on the server…");
    setShowTechnicalLog(false);
    try {
      const res = await api.esphomeCompile(device.id);
      setLastCompileOk(res.ok);
      setRawLog(res.log || (res.ok ? "Build finished." : "Build failed."));
      if (res.ok) {
        onSuccess(`${device.name}: firmware built. Download the install file and flash over USB.`);
      } else {
        onError(`${device.name}: firmware build failed. See details below.`);
      }
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Build failed";
      setRawLog(message);
      onError(message);
    } finally {
      onBusy(false);
    }
  }

  async function runUpload() {
    if (!device) return;
    onBusy(true);
    onError(null);
    setLastAction("upload");
    setRawLog("Sending update to the device over Wi‑Fi…");
    setShowTechnicalLog(false);
    try {
      const res = await api.esphomeUpload(device.id);
      setRawLog(res.log || (res.ok ? "Update finished." : "Update failed."));
      if (res.ok) {
        onSuccess(`${device.name}: update sent. Wait for the device to come back online.`);
      } else {
        onError(`${device.name}: over-the-air update failed.`);
      }
      await onUpdated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setRawLog(message);
      onError(message);
    } finally {
      onBusy(false);
    }
  }

  async function runValidate() {
    if (!device) return;
    onBusy(true);
    onError(null);
    try {
      const res = await api.esphomeValidateYaml(device.id);
      setRawLog(res.log || (res.ok ? "Configuration is valid." : "Validation failed."));
      setLastAction(null);
      if (!res.ok) onError("Configuration check failed");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Validate failed");
    } finally {
      onBusy(false);
    }
  }

  async function runDownloadFirmware() {
    if (!device) return;
    onBusy(true);
    onError(null);
    try {
      const { blob, filename } = await api.esphomeDownloadFirmware(device.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setUsbGuideOpen(true);
      onSuccess(`Downloaded ${filename}. Follow Step 2 below to flash the ESP32.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Firmware download failed");
    } finally {
      onBusy(false);
    }
  }

  async function runSaveYaml() {
    if (!device) return;
    onBusy(true);
    onError(null);
    try {
      const res = await api.esphomeSaveDeviceYaml(device.id, yaml);
      setRawLog(res.log || (res.ok ? "Saved." : "Save failed."));
      setLastAction(null);
      if (res.ok) {
        setManagementMode(res.managementMode);
        onSuccess(`Saved configuration for ${device.name}.`);
        await onUpdated();
      } else {
        onError("Configuration check failed — not saved.");
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      onBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="md">
      <DialogTitle>Install firmware — {device?.name ?? ""}</DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Install" />
          <Tab label="Advanced" />
        </Tabs>

        {tab === 0 && (
          <Stack spacing={2}>
            <Alert severity="info">
              Build firmware on this server, download the <strong>.bin</strong> file, then flash it
              on your computer with ESPHome Web Installer and a USB cable. The YAML configuration
              stays on the server — ESPHome Web does not import YAML for USB install.
            </Alert>

            {buildPrerequisites && !buildPrerequisites.ready && (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Wi‑Fi credentials required before build
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Device Builder firmware uses Wi‑Fi and MQTT settings from{" "}
                  <strong>esphome/secrets.yaml</strong> on this server. The ESPHome dashboard may show
                  Wi‑Fi as unset even when secrets are configured — that view does not show secret
                  values.
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {buildPrerequisites.missing.map((item) => (
                    <li key={item}>
                      <Typography variant="body2">{item}</Typography>
                    </li>
                  ))}
                </Box>
              </Alert>
            )}

            <Alert severity="warning">
              <Typography variant="subtitle2" gutterBottom>
                Device still offline after USB flash?
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {ESPHOME_WRONG_FLASH_RECOVERY.map((line) => (
                  <li key={line}>
                    <Typography variant="body2">{line}</Typography>
                  </li>
                ))}
              </Box>
            </Alert>

            <Typography variant="subtitle2">{ESPHOME_INSTALL_WORKFLOW_TITLE}</Typography>
            <Stepper activeStep={activeStep} orientation="vertical" nonLinear>
              {ESPHOME_INSTALL_STEPS.map((step, index) => (
                <Step key={step.id} completed={index < activeStep} expanded>
                  <StepLabel>{step.title}</StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {step.detail}
                    </Typography>

                    {step.id === "build" && (
                      <Stack spacing={1.5}>
                        <Button
                          variant="contained"
                          disabled={busy || buildPrerequisites?.ready === false}
                          startIcon={<BuildRoundedIcon />}
                          onClick={() => void runCompile()}
                        >
                          {busy && lastAction === "compile" ? "Building…" : "Build firmware"}
                        </Button>
                        {logSummary && lastAction === "compile" && (
                          <Alert
                            severity={
                              (lastCompileOk ?? logSummary.ok)
                                ? "success"
                                : busy
                                  ? "info"
                                  : "error"
                            }
                          >
                            <Typography variant="subtitle2">{logSummary.headline}</Typography>
                            <Typography variant="body2">{logSummary.detail}</Typography>
                          </Alert>
                        )}
                      </Stack>
                    )}

                    {step.id === "usb" && (
                      <ButtonRow>
                        <Button
                          variant="contained"
                          disabled={busy || !canDownloadFirmware}
                          startIcon={<DownloadRoundedIcon />}
                          onClick={() => void runDownloadFirmware()}
                        >
                          Download firmware (.bin)
                        </Button>
                        {!canDownloadFirmware && (
                          <Typography variant="caption" color="text.secondary">
                            Complete Step 1 first — the .bin file is created when the server build
                            finishes.
                          </Typography>
                        )}
                        <Button
                          variant="outlined"
                          href={ESPHOME_WEB_INSTALLER_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<OpenInNewRoundedIcon />}
                        >
                          Open ESPHome Web Installer
                        </Button>
                        <Alert severity="warning" sx={{ mt: 0.5 }}>
                          In ESPHome Web: use <strong>Connect</strong> → <strong>Install</strong> →
                          pick your downloaded <strong>.bin</strong> file. Do not create a new
                          device there — names like &quot;ESPHome Web …&quot; are not your Nexternel
                          device.
                        </Alert>
                        <Collapse in={usbGuideOpen}>
                          <Alert severity="success" sx={{ mt: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              What to do with the file you downloaded
                            </Typography>
                            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                              {ESPHOME_USB_INSTALL_STEPS.map((line) => (
                                <li key={line}>
                                  <Typography variant="body2">{line}</Typography>
                                </li>
                              ))}
                            </Box>
                          </Alert>
                        </Collapse>
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => setShowOtaSection((v) => !v)}
                          endIcon={
                            <ExpandMoreRoundedIcon
                              sx={{
                                transform: showOtaSection ? "rotate(180deg)" : "none",
                                transition: "transform 0.2s",
                              }}
                            />
                          }
                          sx={{ alignSelf: "flex-start" }}
                        >
                          Device already on Wi‑Fi?
                        </Button>
                        <Collapse in={showOtaSection}>
                          <Stack spacing={1} sx={{ pl: 0.5 }}>
                            <Typography variant="body2" color="text.secondary">
                              Only use this if the ESP32 already runs Nexternel firmware and is on
                              your network. New boards need USB install above.
                            </Typography>
                            <Button
                              variant="outlined"
                              disabled={busy || !(compileSucceeded || serverFirmwareReady)}
                              startIcon={<WifiRoundedIcon />}
                              onClick={() => void runUpload()}
                            >
                              {busy && lastAction === "upload"
                                ? "Sending update…"
                                : "Update over Wi‑Fi"}
                            </Button>
                            {logSummary && lastAction === "upload" && (
                              <Alert severity={logSummary.ok ? "success" : "warning"}>
                                <Typography variant="subtitle2">{logSummary.headline}</Typography>
                                <Typography variant="body2">{logSummary.detail}</Typography>
                              </Alert>
                            )}
                          </Stack>
                        </Collapse>
                      </ButtonRow>
                    )}

                    {step.id === "online" && (
                      <Typography variant="body2" color="text.secondary">
                        No action needed — check the Devices page. If it stays offline for more
                        than a few minutes, confirm Wi‑Fi credentials in the install file match your
                        network.
                      </Typography>
                    )}
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            {rawLog && (
              <Box>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => setShowTechnicalLog((v) => !v)}
                  endIcon={
                    <ExpandMoreRoundedIcon
                      sx={{
                        transform: showTechnicalLog ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s",
                      }}
                    />
                  }
                >
                  {showTechnicalLog ? "Hide technical log" : "Show technical log"}
                </Button>
                <Collapse in={showTechnicalLog}>
                  <TextField
                    value={logSummary?.technicalLog || rawLog}
                    multiline
                    minRows={8}
                    fullWidth
                    InputProps={{ readOnly: true }}
                    sx={{ mt: 1, "& textarea, & input": CODE_TEXT }}
                  />
                </Collapse>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary">
              The{" "}
              <Link href={dashboardUrl} target="_blank" rel="noopener noreferrer">
                ESPHome dashboard
              </Link>{" "}
              on this server is for logs and over-the-air updates after the device is online — not
              for first-time USB flash from your laptop.
            </Typography>
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            <Alert severity="warning">
              Manual edits make this file authoritative. The Device Builder may not be able to edit
              this device again.
            </Alert>
            {managementMode === "advanced" && (
              <Typography variant="caption" color="text.secondary">
                Management mode: advanced
              </Typography>
            )}
            {yamlPath && (
              <Typography variant="caption" color="text.secondary" fontFamily={CODE_TEXT.fontFamily}>
                {yamlPath}
              </Typography>
            )}
            <TextField
              value={yaml}
              onChange={(e) => setYaml(e.target.value)}
              multiline
              minRows={14}
              fullWidth
              disabled={busy}
              sx={{ "& textarea, & input": CODE_TEXT }}
            />
            <ButtonRow direction="row">
              <Button variant="outlined" disabled={busy} onClick={() => void runValidate()}>
                Check configuration
              </Button>
              <Button variant="contained" disabled={busy} onClick={() => void runSaveYaml()}>
                Save
              </Button>
            </ButtonRow>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
