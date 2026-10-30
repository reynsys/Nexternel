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
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { api, type DeviceRecord, type EsphomeBuildPrerequisites } from "../../api";
import {
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
  /** "usb": install a new board with a USB cable. "file": its ESPHome settings file (experienced users). */
  mode?: "usb" | "file";
  device: DeviceRecord | null;
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
  mode = "usb",
  device,
  busy,
  onClose,
  onBusy,
  onError,
  onSuccess,
  onUpdated,
}: Props) {
  const tab = mode === "file" ? 1 : 0;
  const [troubleOpen, setTroubleOpen] = useState(false);
  const [rawLog, setRawLog] = useState("");
  const [lastAction, setLastAction] = useState<ActionKind>(null);
  const [showTechnicalLog, setShowTechnicalLog] = useState(false);
  const [yaml, setYaml] = useState("");
  const [yamlPath, setYamlPath] = useState("");
  const [managementMode, setManagementMode] = useState<string | null>(null);
  const [lastCompileOk, setLastCompileOk] = useState<boolean | null>(null);
  const [buildPrerequisites, setBuildPrerequisites] =
    useState<EsphomeBuildPrerequisites | null>(null);

  const lifecycle = device?.esphomeLifecycleState ?? null;

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
    setTroubleOpen(false);
    setRawLog("");
    setLastAction(null);
    setShowTechnicalLog(false);
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
      onSuccess(`Downloaded ${filename}. Now install it with ESPHome Web (step 2).`);
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
      <DialogTitle>
        {mode === "file" ? "Settings file" : "Install with a USB cable"} — {device?.name ?? ""}
      </DialogTitle>
      <DialogContent>

        {tab === 0 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              For a new board, or one that is not on your Wi‑Fi. A board that is already online is updated with{" "}
              <strong>Update board</strong> on its page — no cable needed.
            </Typography>

            {buildPrerequisites && !buildPrerequisites.ready && (
              <Alert severity="warning">
                <Typography variant="subtitle2" gutterBottom>
                  Wi‑Fi details needed first
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

            <Stepper activeStep={Math.max(0, activeStep - 1)} orientation="vertical" nonLinear>
              <Step completed={activeStep > 1} expanded>
                <StepLabel>Prepare the firmware</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Nexternel prepares it on this server. The first time can take several minutes.
                  </Typography>
                  <Stack spacing={1.5} alignItems="flex-start">
                    <Button
                      variant="contained"
                      disabled={busy || buildPrerequisites?.ready === false}
                      startIcon={<BuildRoundedIcon />}
                      onClick={() => void runCompile()}
                    >
                      {busy && lastAction === "compile" ? "Preparing…" : "Prepare firmware"}
                    </Button>
                    {logSummary && lastAction === "compile" && (
                      <Alert severity={(lastCompileOk ?? logSummary.ok) ? "success" : busy ? "info" : "error"} sx={{ alignSelf: "stretch" }}>
                        <Typography variant="subtitle2">{logSummary.headline}</Typography>
                        <Typography variant="body2">{logSummary.detail}</Typography>
                      </Alert>
                    )}
                  </Stack>
                </StepContent>
              </Step>
              <Step completed={activeStep > 2} expanded>
                <StepLabel>Install it with the cable</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Download the file. Plug the board into this computer with a USB cable, open ESPHome Web in Chrome or Edge, then
                    choose <strong>Connect</strong> → <strong>Install</strong> → the file you downloaded.
                  </Typography>
                  <ButtonRow direction="row" flexWrap="wrap" useFlexGap>
                    <Button
                      variant="contained"
                      disabled={busy || !canDownloadFirmware}
                      startIcon={<DownloadRoundedIcon />}
                      onClick={() => void runDownloadFirmware()}
                    >
                      Download the file
                    </Button>
                    <Button
                      variant="outlined"
                      href={ESPHOME_WEB_INSTALLER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      endIcon={<OpenInNewRoundedIcon />}
                    >
                      Open ESPHome Web
                    </Button>
                  </ButtonRow>
                </StepContent>
              </Step>
              <Step completed={false} expanded>
                <StepLabel>The board joins your home</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Unplug it and power it as usual. It shows <strong>Online</strong> on the Devices page within a few minutes.
                  </Typography>
                </StepContent>
              </Step>
            </Stepper>

            <Box>
              <Button
                variant="outlined"
                size="small"
                aria-expanded={troubleOpen}
                onClick={() => setTroubleOpen((v) => !v)}
                endIcon={<ExpandMoreRoundedIcon sx={{ transform: troubleOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />}
              >
                Having trouble?
              </Button>
              <Collapse in={troubleOpen}>
                <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Step by step in ESPHome Web
                    </Typography>
                    <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                      {ESPHOME_USB_INSTALL_STEPS.map((line) => (
                        <li key={line}>
                          <Typography variant="body2">{line}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      The board stays offline after installing
                    </Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {ESPHOME_WRONG_FLASH_RECOVERY.map((line) => (
                        <li key={line}>
                          <Typography variant="body2">{line}</Typography>
                        </li>
                      ))}
                    </Box>
                  </Box>
                  {rawLog ? (
                    <Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setShowTechnicalLog((v) => !v)}
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
                  ) : null}
                </Stack>
              </Collapse>
            </Box>
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
