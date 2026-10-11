import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  ESPHOME_BUILDER_CONFIG_VERSION,
  ESPHOME_BOARD_CATALOG,
  boardCatalogEntry,
  builderComponentLabel,
  componentCatalogEntry,
  createDefaultBuilderComponent,
  type BuilderComponent,
  type BuilderComponentKind,
  type EsphomeBoardId,
  type EsphomeDeviceBuilderConfig,
  type EsphomePlatform,
} from "@nexternel/domain";
import {
  api,
  type EsphomeBuilderMapped,
  type EsphomeBuilderPreview,
  type EsphomeCatalogEntry,
} from "../../api";
import { AREA } from "../../lib/area-labels";
import {
  ESPHOME_INSTALL_WORKFLOW_TITLE,
  esphomeInstallActiveStep,
} from "../../lib/esphome-install-guide";
import { InstallWorkflowStepper } from "./InstallWorkflowStepper";
import { BuilderComponentFields } from "./esphome/BuilderComponentFields";
import { BuilderComponentPicker } from "./esphome/BuilderComponentPicker";
import { useConfirm } from "../../components/confirm";

type AreaOption = { id: string; name: string };

type Path = "choose" | "new" | "import" | "created";

type NewStep = "hardware" | "identity" | "components" | "review";

type CreatedDevice = { deviceId: string; name: string };

type Props = {
  open: boolean;
  busy: boolean;
  hostname: string;
  areas: AreaOption[];
  catalog: EsphomeCatalogEntry[];
  /** Pre-select import for a catalog file stem (no .yaml). */
  initialImportFile?: string | null;
  /** Re-open wizard for an existing managed device. */
  editDeviceId?: string | null;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
  onCreated: () => void | Promise<void>;
  /** Open the Devices ESPHome panel for compile / install (Phase 10). */
  onOpenEsphomePanel?: (deviceId: string) => void;
};

function boardsForPlatform(platform: EsphomePlatform) {
  return ESPHOME_BOARD_CATALOG.filter((b) => b.platform === platform);
}

export function EsphomeAddDeviceWizard({
  open,
  busy,
  areas,
  catalog,
  initialImportFile,
  editDeviceId,
  onClose,
  onBusy,
  onError,
  onSuccess,
  onCreated,
  onOpenEsphomePanel,
}: Props) {
  const { confirm } = useConfirm();
  const [path, setPath] = useState<Path>("choose");
  const [newStep, setNewStep] = useState<NewStep>("hardware");
  const [platform, setPlatform] = useState<EsphomePlatform>("esp32");
  const [boardId, setBoardId] = useState<EsphomeBoardId>("esp32dev");
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [components, setComponents] = useState<BuilderComponent[]>([]);
  const [validationIssues, setValidationIssues] = useState<
    { path: string; message: string }[]
  >([]);
  const [preview, setPreview] = useState<EsphomeBuilderPreview | null>(null);
  const [importFile, setImportFile] = useState("");
  const [importPreview, setImportPreview] = useState<{ mapped: EsphomeBuilderMapped[] | null } | null>(
    null
  );
  const [editLoading, setEditLoading] = useState(false);
  const [createdDevice, setCreatedDevice] = useState<CreatedDevice | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);

  const isEditMode = Boolean(editDeviceId);

  const importable = useMemo(
    () => catalog.filter((c) => !c.registered),
    [catalog]
  );
  const boardGpioMax = useMemo(
    () => boardCatalogEntry(boardId)?.gpioMax ?? 39,
    [boardId]
  );

  function addComponent(kind: BuilderComponentKind) {
    setComponents((list) => [...list, createDefaultBuilderComponent(kind, list)]);
  }

  const builderConfig = useMemo((): EsphomeDeviceBuilderConfig => {
    return {
      version: ESPHOME_BUILDER_CONFIG_VERSION,
      platform,
      boardId,
      displayName: displayName.trim(),
      roomId: roomId || null,
      components,
    };
  }, [platform, boardId, displayName, roomId, components]);

  const newSteps: NewStep[] = ["hardware", "identity", "components", "review"];
  const newStepIndex = newSteps.indexOf(newStep);

  function reset() {
    setPath("choose");
    setNewStep("hardware");
    setPlatform("esp32");
    setBoardId("esp32dev");
    setDisplayName("");
    setRoomId("");
    setComponents([]);
    setValidationIssues([]);
    setPreview(null);
    setImportFile("");
    setImportPreview(null);
    setCreatedDevice(null);
    setDialogError(null);
    setPreviewLoading(false);
    setPreviewLoadError(null);
  }

  function finishWizard() {
    reset();
    onClose();
  }

  function openEsphomePanelForCreated() {
    if (!createdDevice) return;
    onOpenEsphomePanel?.(createdDevice.deviceId);
    finishWizard();
  }

  useEffect(() => {
    if (!open) return;
    if (editDeviceId) {
      setEditLoading(true);
      onError(null);
      void api
        .esphomeBuilderGetConfig(editDeviceId)
        .then((res) => {
          const cfg = res.config as EsphomeDeviceBuilderConfig;
          setPath("new");
          setNewStep("hardware");
          setPlatform(cfg.platform);
          setBoardId(cfg.boardId);
          setDisplayName(cfg.displayName);
          setRoomId(cfg.roomId ?? "");
          setComponents(cfg.components ?? []);
          setValidationIssues([]);
          setPreview(null);
        })
        .catch((err) => {
          onError(err instanceof Error ? err.message : "Failed to load configuration");
        })
        .finally(() => setEditLoading(false));
      return;
    }
    if (initialImportFile) {
      setPath("import");
      setImportFile(initialImportFile);
    } else {
      reset();
    }
  }, [open, initialImportFile, editDeviceId, onError]);

  useEffect(() => {
    const boards = boardsForPlatform(platform);
    if (!boards.some((b) => b.id === boardId)) {
      setBoardId(boards[0]?.id ?? "esp32dev");
    }
  }, [platform, boardId]);

  useEffect(() => {
    if (!open || path !== "import" || !importFile) {
      setImportPreview(null);
      return;
    }
    let cancelled = false;
    void api
      .v4EsphomePreview(importFile, roomId || null)
      .then((res) => {
        if (!cancelled) setImportPreview(res);
      })
      .catch(() => {
        if (!cancelled) setImportPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, path, importFile, roomId]);

  const loadPreview = useCallback(() => {
    setPreviewLoading(true);
    setPreviewLoadError(null);
    setPreview(null);
    return api
      .esphomeBuilderPreview(builderConfig, roomId || null)
      .then((res) => {
        setPreview(res);
        setValidationIssues(res.validation.issues);
        if (!res.ok) {
          setDialogError(
            res.validation.issues[0]?.message ??
              "Fix the configuration issues below before creating the device."
          );
        }
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Could not check configuration";
        setPreviewLoadError(message);
        setDialogError(message);
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [builderConfig, roomId]);

  useEffect(() => {
    if (!open || path !== "new" || newStep !== "review") {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewLoadError(null);
      return;
    }
    void loadPreview();
  }, [open, path, newStep, loadPreview]);

  const createBlockedReason = useMemo(() => {
    if (previewLoading) return "Checking configuration…";
    if (validationIssues.length > 0) return "Fix the configuration issues above";
    if (!displayName.trim()) return "Enter a device name";
    if (components.length === 0) return "Add at least one component";
    return null;
  }, [previewLoading, validationIssues, displayName, components]);

  async function validateCurrentNewStep(): Promise<boolean> {
    if (newStep === "hardware") {
      onError(null);
      setDialogError(null);
      return true;
    }
    if (newStep === "identity") {
      if (!displayName.trim()) {
        setDialogError("Device name is required");
        onError("Device name is required");
        return false;
      }
      if (/^\d/.test(displayName.trim())) {
        setDialogError("Device name must not start with a number");
        onError("Device name must not start with a number");
        return false;
      }
      onError(null);
      setDialogError(null);
      return true;
    }
    const res = await api.esphomeBuilderValidate(builderConfig);
    setValidationIssues(res.issues);
    if (!res.valid) {
      const message = res.issues[0]?.message ?? "Fix the configuration before continuing";
      setDialogError(message);
      onError(message);
      return false;
    }
    onError(null);
    setDialogError(null);
    return true;
  }

  async function onNextNew() {
    onBusy(true);
    try {
      const ok = await validateCurrentNewStep();
      if (!ok) return;
      const idx = newStepIndex;
      if (idx < newSteps.length - 1) {
        setNewStep(newSteps[idx + 1]);
      }
    } finally {
      onBusy(false);
    }
  }

  function onBackNew() {
    const idx = newStepIndex;
    if (idx > 0) setNewStep(newSteps[idx - 1]);
    else setPath("choose");
  }

  async function onCreateNew(e: FormEvent) {
    e.preventDefault();
    onBusy(true);
    onError(null);
    setDialogError(null);
    try {
      const validation = await api.esphomeBuilderValidate(builderConfig);
      setValidationIssues(validation.issues);
      if (!validation.valid) {
        setDialogError(
          validation.issues[0]?.message ??
            "Fix the configuration before creating the device."
        );
        return;
      }

      if (isEditMode && editDeviceId) {
        await api.esphomeBuilderUpdate(editDeviceId, builderConfig, roomId || null);
        onSuccess(
          `Saved ${displayName.trim()}. Open Install firmware on the Devices page to build and flash the board.`
        );
        await Promise.resolve(onCreated());
        finishWizard();
      } else {
        const result = await api.esphomeBuilderCreate(builderConfig, roomId || null);
        await Promise.resolve(onCreated());
        setCreatedDevice({ deviceId: result.deviceId, name: displayName.trim() });
        setPath("created");
        setDialogError(null);
        onSuccess(`Created ${displayName.trim()}. Continue with firmware install below.`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : isEditMode ? "Save failed" : "Create failed";
      if (/already exists/i.test(message)) {
        setDialogError(
          `${message} Open the existing device on the Devices page and use Install firmware to continue setup.`
        );
      } else {
        setDialogError(message);
      }
      onError(message);
    } finally {
      onBusy(false);
    }
  }

  async function onImportCreate(e: FormEvent) {
    e.preventDefault();
    if (!importFile) {
      onError("Select a device configuration");
      return;
    }
    onBusy(true);
    onError(null);
    try {
      const entry = catalog.find((c) => c.fileName === importFile);
      const onboarded = await api.v4OnboardEsphome({
        yamlName: importFile,
        name: entry?.suggestion?.esphomeName
          ? undefined
          : importFile.replace(/-/g, " "),
        roomId: roomId || null,
      });
      onSuccess(
        onboarded.firmwareReplaced
          ? `Registered ${importFile}. Its firmware file now matches Nexternel. Install it on the board to replace the previous firmware.`
          : `Registered ${importFile}. Capabilities are ready — no separate sync needed.`
      );
      onCreated();
      onClose();
      reset();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed");
    } finally {
      onBusy(false);
    }
  }

  const dialogTitle =
    path === "created"
      ? "Device created"
      : isEditMode
        ? "Edit ESPHome configuration"
        : path === "choose"
          ? "Add device"
          : path === "import"
            ? "Import ESPHome device"
            : "New ESPHome device";

  const installActiveStep = esphomeInstallActiveStep("awaiting_installation");

  return (
    <Dialog
      open={open}
      onClose={() => !busy && finishWizard()}
      fullWidth
      maxWidth="md"
    >
      <form
        onSubmit={(e) => {
          if (path === "new" && newStep === "review") void onCreateNew(e);
          else if (path === "import") void onImportCreate(e);
          else e.preventDefault();
        }}
      >
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          {dialogError && path !== "created" && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDialogError(null)}>
              {dialogError}
            </Alert>
          )}
          {editLoading && (
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Loading configuration…
            </Typography>
          )}
          {!editLoading && path === "choose" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography color="text.secondary">
                Add a new ESP32 or ESP8266 by describing the hardware attached to it.
                Nexternel generates the configuration and registers capabilities automatically.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => {
                  setPath("new");
                  setNewStep("hardware");
                }}
              >
                New ESPHome device
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => setPath("import")}
              >
                Import existing configuration
              </Button>
              <Typography variant="caption" color="text.secondary">
                Import is for YAML already on this server (migration or advanced setups).
              </Typography>
            </Stack>
          )}

          {!editLoading && path === "new" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stepper activeStep={newStepIndex} alternativeLabel>
                <Step>
                  <StepLabel>Hardware</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Device</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Components</StepLabel>
                </Step>
                <Step>
                  <StepLabel>Review</StepLabel>
                </Step>
              </Stepper>

              {newStep === "hardware" && (
                <Stack spacing={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="esp-platform">Platform</InputLabel>
                    <Select
                      labelId="esp-platform"
                      label="Platform"
                      value={platform}
                      onChange={(e) =>
                        setPlatform(e.target.value as EsphomePlatform)
                      }
                    >
                      <MenuItem value="esp32">ESP32</MenuItem>
                      <MenuItem value="esp8266">ESP8266</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel id="esp-board">Board</InputLabel>
                    <Select
                      labelId="esp-board"
                      label="Board"
                      value={boardId}
                      onChange={(e) =>
                        setBoardId(e.target.value as EsphomeBoardId)
                      }
                    >
                      {boardsForPlatform(platform).map((b) => (
                        <MenuItem key={b.id} value={b.id}>
                          {b.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}

              {newStep === "identity" && (
                <Stack spacing={2}>
                  <TextField
                    label="Device name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    fullWidth
                    autoFocus
                    helperText="Shown in Nexternel (e.g. Garden Controller). Must not start with a number."
                  />
                  <FormControl fullWidth size="small">
                    <InputLabel id="esp-area">{AREA.singular}</InputLabel>
                    <Select
                      labelId="esp-area"
                      label={AREA.singular}
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                    >
                      <MenuItem value="">— None —</MenuItem>
                      {areas.map((a) => (
                        <MenuItem key={a.id} value={a.id}>
                          {a.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              )}

              {newStep === "components" && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Choose sensors and relays from the component catalogue. Wi-Fi and MQTT
                    are configured automatically from this server.
                  </Typography>
                  {components.length === 0 && (
                    <Alert severity="info">
                      Add at least one sensor or relay using <strong>Add component</strong>{" "}
                      below.
                    </Alert>
                  )}
                  {components.map((comp, index) => {
                    const catalogEntry = componentCatalogEntry(comp.kind);
                    if (!catalogEntry) return null;
                    return (
                      <Box
                        key={comp.id}
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          p: 1.5,
                        }}
                      >
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{ mb: 1 }}
                        >
                          <Typography fontWeight={600}>
                            {builderComponentLabel(comp.kind)}
                          </Typography>
                          <IconButton
                            size="small"
                            aria-label="Remove component"
                            onClick={() => {
                              void (async () => {
                                const ok = await confirm({
                                  title: "Remove component?",
                                  message: `Remove ${builderComponentLabel(comp.kind)} from this device configuration?`,
                                  confirmLabel: "Remove",
                                });
                                if (ok) {
                                  setComponents((list) =>
                                    list.filter((_, i) => i !== index)
                                  );
                                }
                              })();
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <BuilderComponentFields
                          component={comp}
                          catalogEntry={catalogEntry}
                          gpioMax={boardGpioMax}
                          onChange={(next) =>
                            setComponents((list) =>
                              list.map((c, i) => (i === index ? next : c))
                            )
                          }
                        />
                      </Box>
                    );
                  })}
                  <BuilderComponentPicker
                    platform={platform}
                    onPick={addComponent}
                    onBrowseImport={() => setPath("import")}
                  />
                </Stack>
              )}

              {newStep === "review" && (
                <Stack spacing={2}>
                  {previewLoading && (
                    <Typography color="text.secondary">Checking configuration…</Typography>
                  )}
                  {!previewLoading && previewLoadError && (
                    <Alert
                      severity="warning"
                      action={
                        <Button color="inherit" size="small" onClick={() => void loadPreview()}>
                          Retry
                        </Button>
                      }
                    >
                      Could not load a full preview ({previewLoadError}). You can still create the
                      device if the configuration is valid.
                    </Alert>
                  )}
                  {validationIssues.length > 0 && (
                    <Alert severity="error">
                      {validationIssues.map((i) => (
                        <div key={`${i.path}-${i.message}`}>{i.message}</div>
                      ))}
                    </Alert>
                  )}
                  {preview?.mapped?.length ? (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Capabilities to create
                      </Typography>
                      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                        {preview.mapped.map((m) => (
                          <li key={`${m.kind}-${m.name}`}>
                            {m.name} ({m.kind})
                            {m.systemId ? ` · ${m.systemId}` : ""}
                          </li>
                        ))}
                      </ul>
                    </Box>
                  ) : null}
                  {!isEditMode && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        {ESPHOME_INSTALL_WORKFLOW_TITLE}
                      </Typography>
                      <InstallWorkflowStepper activeStep={0} />
                    </Box>
                  )}
                  <Alert severity="info">
                    After you create the device, the next step is to build firmware on this server,
                    download the .bin file, and flash the ESP32 over USB.
                  </Alert>
                </Stack>
              )}
            </Stack>
          )}

          {!editLoading && path === "import" && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="import-yaml">Server configuration</InputLabel>
                <Select
                  labelId="import-yaml"
                  label="Server configuration"
                  value={importFile}
                  onChange={(e) => setImportFile(e.target.value)}
                  required
                >
                  <MenuItem value="">— Select —</MenuItem>
                  {importable.map((c) => (
                    <MenuItem key={c.fileName} value={c.fileName}>
                      {c.fileName}.yaml
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel id="import-area">{AREA.singular}</InputLabel>
                <Select
                  labelId="import-area"
                  label={AREA.singular}
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  <MenuItem value="">— None —</MenuItem>
                  {areas.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {importPreview?.mapped?.length ? (
                <Typography variant="body2" color="text.secondary">
                  Will register {importPreview.mapped.length} capability/capabilities
                  from the YAML.
                </Typography>
              ) : null}
              {importable.length === 0 && (
                <Alert severity="warning">
                  No unregistered YAML files found on the server.
                </Alert>
              )}
            </Stack>
          )}

          {!editLoading && path === "created" && createdDevice && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="success">
                <strong>{createdDevice.name}</strong> is registered on this server. The ESP32
                board still needs firmware — follow the steps below.
              </Alert>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {ESPHOME_INSTALL_WORKFLOW_TITLE}
                </Typography>
                <InstallWorkflowStepper activeStep={installActiveStep} />
              </Box>
              <Button
                variant="contained"
                startIcon={<BuildRoundedIcon />}
                onClick={openEsphomePanelForCreated}
              >
                Build firmware on server
              </Button>
              <Typography variant="body2" color="text.secondary">
                Opens the install guide for this device. Step 2: build firmware here, then download
                the .bin file and flash over USB with ESPHome Web Installer on your computer.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {path === "created" ? (
            <Button variant="contained" onClick={finishWizard}>
              Done
            </Button>
          ) : (
            <>
          <Button onClick={() => finishWizard()} disabled={busy}>
            Cancel
          </Button>
          {path === "choose" ? null : path === "import" ? (
            <Button type="submit" variant="contained" disabled={busy || !importFile}>
              {busy ? "Registering…" : "Register device"}
            </Button>
          ) : newStep === "review" ? (
            <>
              <Button onClick={onBackNew} disabled={busy}>
                Back
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={busy || Boolean(createBlockedReason)}
                title={createBlockedReason ?? undefined}
              >
                {busy
                  ? isEditMode
                    ? "Saving…"
                    : "Creating…"
                  : isEditMode
                    ? "Save configuration"
                    : "Create device"}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onBackNew} disabled={busy}>
                Back
              </Button>
              <Button variant="contained" onClick={() => void onNextNew()} disabled={busy}>
                Next
              </Button>
            </>
          )}
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
