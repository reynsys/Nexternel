import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import DeviceHubOutlinedIcon from "@mui/icons-material/DeviceHubOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import DeveloperBoardOutlinedIcon from "@mui/icons-material/DeveloperBoardOutlined";
import { useMediaQuery, useTheme, ButtonBase, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { FoundDevice } from "@nexternel/domain";
import { api } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { insetSx } from "../../../skins/surfaceStyles";
import { DevicesWifiExplainer, DevicesWifiForm } from "../../../components/DevicesWifi";
import { ShellyGuide, type ShellyGuideStep } from "./ShellyGuide";
import { ZherodiusPaired, ZherodiusPairing, type Paired } from "./ZherodiusPairing";

/** What happens to one device while it is being brought in. */
export type BringInState = { status: "working" | "done" | "failed" | "password" | "wifi"; message?: string };

export type AddDeviceDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Areas a new device can be put in. */
  areas: { id: string; name: string }[];
  /** A camera: opens the camera window (with the address when Search this network found one). */
  onAddCamera: (host?: string) => void;
  /** A device was added from a guide: show it. */
  onDeviceAdded: (deviceId: string) => void;
  /** Open a device or camera Nexternel already has. */
  onOpenExisting: (found: FoundDevice) => void;
  /** Bring the ticked devices in; reports each device as it goes (password: the device's own, when it has one). */
  onBringIn: (
    devices: FoundDevice[],
    report: (key: string, state: BringInState) => void,
    password?: string
  ) => Promise<void>;
};

type Stage = "start" | "searching" | "results" | "shelly" | "zherodius" | "paired" | "soon" | "more";

/** Kinds that have a tile but can't be added yet. */
type SoonKind = "board" | "zigbee" | "matter";
const SOON: Record<SoonKind, { title: string; sentence: string }> = {
  board: {
    title: "ESP32 board",
    sentence: "Adding a new ESP32 board comes with Nexternel's own board software, which is being built now.",
  },
  zigbee: { title: "Zigbee device", sentence: "Zigbee devices come in a later update. They'll need a small Zigbee USB stick in the Nexternel computer." },
  matter: { title: "Matter device", sentence: "Matter devices come in a later update. You'll add one by scanning the code on the device or its box." },
};

/** The plain sentence that says what bringing this device in does. */
export function bringInSentence(d: FoundDevice): string {
  switch (d.kind) {
    case "zherodius":
      return "Pair it with the code shown on its own page.";
    case "board":
      return "Nexternel puts its own board software on it once (about 2 minutes). After that, other systems no longer see it.";
    case "shelly":
      return "Nexternel changes one setting on the switch so it reports here. It keeps working with the system that uses it now.";
    case "camera":
      return "Add it with the camera's user name and password.";
    case "matterNew":
    case "matterShared":
      return "A Matter device. Nexternel can't add Matter devices yet.";
    default:
      return "Nexternel can't control this yet. It stays as it is.";
  }
}

function canBringIn(d: FoundDevice): boolean {
  return !d.alreadyIn && (d.kind === "board" || d.kind === "shelly");
}

function Row(props: {
  device: FoundDevice;
  ticked?: boolean;
  onTick?: (on: boolean) => void;
  state?: BringInState;
  action?: React.ReactNode;
  dim?: boolean;
  onPassword?: (password: string) => void;
  onWifiSaved?: () => void;
}) {
  const { device: d, state } = props;
  const [password, setPassword] = useState("");
  return (
    <Stack
      direction="row"
      gap={1.5}
      alignItems="flex-start"
      sx={[{ px: 1.5, py: 1.25, opacity: props.dim ? 0.75 : 1 }, insetSx()]}
    >
      {props.onTick ? (
        <Checkbox
          checked={Boolean(props.ticked)}
          onChange={(e) => props.onTick?.(e.target.checked)}
          disabled={Boolean(state && state.status !== "failed")}
          inputProps={{ "aria-label": `Bring in ${d.name}` }}
          sx={{ p: 0.25, mt: 0.25 }}
        />
      ) : null}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap">
          <Typography fontWeight="fontWeightMedium" sx={{ overflowWrap: "anywhere" }}>
            {d.name}
          </Typography>
          {d.what !== d.name ? (
            <Typography variant="body2" color="text.secondary">
              {d.what}
            </Typography>
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {d.alreadyIn ? `Already in Nexternel as “${d.alreadyIn.name}”.` : bringInSentence(d)}
        </Typography>
        {state ? (
          <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 0.5 }}>
            {state.status === "working" ? <CircularProgress size={14} /> : null}
            <Typography
              variant="body2"
              color={state.status === "failed" ? "error" : state.status === "done" ? "success.main" : "text.primary"}
              role={state.status === "failed" ? "alert" : undefined}
            >
              {state.message ?? (state.status === "working" ? "Bringing in…" : state.status === "done" ? "Brought in" : "Didn't work")}
            </Typography>
          </Stack>
        ) : null}
        {state?.status === "wifi" && props.onWifiSaved ? (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <DevicesWifiExplainer />
            <DevicesWifiForm idPrefix={`bring-in-wifi-${d.key}`} saveLabel="Save and bring in" onSaved={props.onWifiSaved} />
          </Stack>
        ) : null}
        {state?.status === "password" && props.onPassword ? (
          <Stack
            component="form"
            direction="row"
            gap={1}
            alignItems="center"
            flexWrap="wrap"
            sx={{ mt: 1 }}
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              if (password) props.onPassword?.(password);
            }}
          >
            <TextField
              id={`bring-in-password-${d.key}`}
              size="small"
              type="password"
              label="The switch's password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <ButtonRow>
              <Button type="submit" variant="contained" size="small" disabled={!password}>
                Bring in
              </Button>
            </ButtonRow>
          </Stack>
        ) : null}
      </Box>
      {props.action ? <Box sx={{ flexShrink: 0 }}>{props.action}</Box> : null}
    </Stack>
  );
}

function Group(props: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Stack gap={1}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" gap={1} flexWrap="wrap">
        <Typography variant="subtitle1">{props.title}</Typography>
        {props.note ? (
          <Typography variant="body2" color="text.secondary">
            {props.note}
          </Typography>
        ) : null}
      </Stack>
      {props.children}
    </Stack>
  );
}

/**
 * Devices → Add device. "Search this network" looks for devices on Nexternel's network and lists what it finds,
 * grouped by what bringing it in takes; below it, the ways to add one yourself.
 */
export function AddDeviceDialog(props: AddDeviceDialogProps) {
  const [stage, setStage] = useState<Stage>("start");
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [states, setStates] = useState<Record<string, BringInState>>({});
  const [bringing, setBringing] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [shellyStep, setShellyStep] = useState<ShellyGuideStep>(1);
  const [soon, setSoon] = useState<SoonKind>("board");
  const [pairing, setPairing] = useState<FoundDevice | null>(null);
  const [paired, setPaired] = useState<Paired | null>(null);
  /** Found devices added in this window (by key → the new device's id). */
  const [added, setAdded] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));

  const groups = useMemo(() => {
    const ready = found.filter(canBringIn);
    const zherodius = found.filter((d) => d.kind === "zherodius" && !d.alreadyIn);
    const cameras = found.filter((d) => d.kind === "camera" && !d.alreadyIn);
    const existing = found.filter((d) => d.alreadyIn);
    // Devices Nexternel cannot do anything with (a TV, a speaker) are not listed.
    return { ready, zherodius, cameras, existing };
  }, [found]);

  const shownCount = groups.ready.length + groups.zherodius.length + groups.cameras.length + groups.existing.length;

  const chosen = groups.ready.filter(
    (d) => ticked.has(d.key) && (!states[d.key] || states[d.key].status === "failed")
  );

  function reset() {
    setStage("start");
    setFound([]);
    setError(null);
    setTicked(new Set());
    setStates({});
    setShowExisting(false);
    setShellyStep(1);
    setPairing(null);
    setPaired(null);
    setAdded({});
  }

  /** Closing ends what was going on: the window opens again at the start. */
  function close() {
    if (bringing) return;
    finish();
  }

  /** Close and start fresh next time (the job is done, or another window takes over). */
  function finish() {
    props.onClose();
    reset();
  }

  async function search() {
    setStage("searching");
    setError(null);
    setStates({});
    try {
      const res = await api.homeNetworkSearch();
      setFound(res.devices);
      setTicked(new Set(res.devices.filter(canBringIn).map((d) => d.key)));
      setStage("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The search of this network didn't finish. Try again.");
      setStage("start");
    }
  }

  async function bringIn(list: FoundDevice[], password?: string) {
    if (!list.length) return;
    setBringing(true);
    try {
      await props.onBringIn(list, (key, state) => setStates((s) => ({ ...s, [key]: state })), password);
    } finally {
      setBringing(false);
    }
  }

  const tile = (o: { key: string; title: string; text: string; icon: React.ReactNode; ready?: boolean; soon?: boolean; go: () => void }) => (
    <ButtonBase
      key={o.key}
      onClick={o.go}
      focusRipple
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
          textAlign: "left",
          gap: 1,
          p: 1.75,
          minWidth: 0,
          borderRadius: "var(--nx-control-radius, 12px)",
        },
        insetSx(),
      ]}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ opacity: o.soon ? 0.6 : 1, display: "flex" }} aria-hidden>
          {o.icon}
        </Box>
        {o.ready ? <Chip size="small" variant="outlined" color="success" label="Ready" /> : null}
        {o.soon ? <Chip size="small" variant="outlined" label="Coming soon" /> : null}
      </Stack>
      <Typography fontWeight="fontWeightMedium" sx={{ opacity: o.soon ? 0.75 : 1 }}>
        {o.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {o.text}
      </Typography>
    </ButtonBase>
  );

  const kinds = (
    <Stack gap={1.25}>
      <Typography variant="subtitle1">Or pick what you have in your hand</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>
        {tile({
          key: "zherodius",
          title: "Zherodius",
          text: "A Zherodius device that is already on your Wi-Fi",
          icon: <DeveloperBoardOutlinedIcon />,
          ready: true,
          go: () => void search(),
        })}
        {tile({
          key: "shelly",
          title: "Shelly",
          text: "A new Shelly switch, plug or dimmer, still in its box",
          icon: <ToggleOnOutlinedIcon />,
          ready: true,
          go: () => {
            setShellyStep(1);
            setStage("shelly");
          },
        })}
        {tile({
          key: "camera",
          title: "Camera or doorbell",
          text: "One that gives a live picture over the network",
          icon: <VideocamOutlinedIcon />,
          ready: true,
          go: () => {
            finish();
            props.onAddCamera();
          },
        })}
        {(["board", "zigbee", "matter"] as const).map((k) =>
          tile({
            key: k,
            title: SOON[k].title,
            text:
              k === "board"
                ? "A bare board you're building into something"
                : k === "zigbee"
                  ? "IKEA, Hue, Aqara, Sonoff sensors and bulbs"
                  : "Anything with the Matter logo",
            icon: k === "board" ? <MemoryOutlinedIcon /> : k === "zigbee" ? <HubOutlinedIcon /> : <DeviceHubOutlinedIcon />,
            soon: true,
            go: () => {
              setSoon(k);
              setStage("soon");
            },
          })
        )}
        {tile({
          key: "more",
          title: "More kinds",
          text: "Online services and other devices, added through Extensions",
          icon: <ExtensionOutlinedIcon />,
          go: () => setStage("more"),
        })}
      </Box>
    </Stack>
  );

  return (
    <Dialog
      open={props.open}
      // Only its own buttons close it: a click beside it must not lose what was going on.
      onClose={(_, reason) => {
        if (reason !== "backdropClick") close();
      }}
      fullWidth
      fullScreen={phone}
      maxWidth="sm"
    >
      <DialogTitle>{stage === "shelly" ? "Add a Shelly" : stage === "zherodius" ? "Add a Zherodius device" : "Add a device"}</DialogTitle>
      <DialogContent>
        <Stack gap={2.5} sx={{ mt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {stage === "start" ? (
            <>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                gap={1.5}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
                sx={(t) => ({ p: 2, borderRadius: "var(--nx-control-radius, 12px)", border: `1px solid ${t.palette.primary.main}` })}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight="fontWeightMedium">Devices already on this network</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nexternel looks for devices on the network it's connected to and lists them. Nothing changes until you choose.
                  </Typography>
                </Box>
                <ButtonRow sx={{ flexShrink: 0 }}>
                  <Button variant="contained" startIcon={<SearchIcon />} onClick={() => void search()}>
                    Search this network
                  </Button>
                </ButtonRow>
              </Stack>
              {kinds}
            </>
          ) : null}

          {stage === "shelly" ? (
            <ShellyGuide
              step={shellyStep}
              onStep={setShellyStep}
              areas={props.areas}
              onLeave={reset}
              onFinished={(id) => {
                finish();
                props.onDeviceAdded(id);
              }}
            />
          ) : null}

          {stage === "zherodius" && pairing ? (
            <ZherodiusPairing
              device={pairing}
              areas={props.areas}
              onBack={() => {
                setPairing(null);
                setStage("results");
              }}
              onPaired={(p) => {
                setPaired(p);
                setAdded((a) => ({ ...a, [pairing.key]: p.deviceId }));
                setStage("paired");
              }}
            />
          ) : null}

          {stage === "paired" && paired ? (
            <ZherodiusPaired
              paired={paired}
              onOpen={() => {
                finish();
                props.onDeviceAdded(paired.deviceId);
              }}
              onAddAnother={() => {
                setPaired(null);
                setPairing(null);
                setStage("results");
              }}
            />
          ) : null}

          {stage === "soon" ? (
            <Stack gap={2}>
              <Typography variant="h6">{SOON[soon].title}: coming soon</Typography>
              <Typography>{SOON[soon].sentence}</Typography>
              <Typography color="text.secondary">
                If it is already on this network, Search this network may be able to bring it in.
              </Typography>
              <ButtonRow justifyContent="space-between">
                <Button onClick={reset}>Back</Button>
                <Button variant="contained" startIcon={<SearchIcon />} onClick={() => void search()}>
                  Search this network
                </Button>
              </ButtonRow>
            </Stack>
          ) : null}

          {stage === "more" ? (
            <Stack gap={2}>
              <Typography variant="h6">More kinds</Typography>
              <Typography>
                Online services, such as Octopus Energy, are set up in their own settings. More kinds of devices come as
                Extensions.
              </Typography>
              <ButtonRow justifyContent="space-between">
                <Button onClick={reset}>Back</Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    finish();
                    navigate("/extensions");
                  }}
                >
                  Open extensions
                </Button>
              </ButtonRow>
            </Stack>
          ) : null}

          {stage === "searching" ? (
            <Stack direction="row" gap={1.5} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={22} />
              <Typography>Looking for devices on this network… this takes about 5 seconds.</Typography>
            </Stack>
          ) : null}

          {stage === "results" ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {shownCount === 0
                  ? "Nexternel found nothing it can add on this network. Devices that are switched off, or on a different network, can't be found."
                  : `Found ${shownCount === 1 ? "1 device" : `${shownCount} devices`}.`}
              </Typography>

              {groups.ready.length ? (
                <Group title="Ready to bring in" note="Tick the ones you want in Nexternel">
                  {groups.ready.map((d) => (
                    <Row
                      key={d.key}
                      device={d}
                      ticked={ticked.has(d.key)}
                      state={states[d.key]}
                      onPassword={(pw) => void bringIn([d], pw)}
                      onWifiSaved={() => void bringIn([d])}
                      onTick={(on) =>
                        setTicked((t) => {
                          const next = new Set(t);
                          if (on) next.add(d.key);
                          else next.delete(d.key);
                          return next;
                        })
                      }
                    />
                  ))}
                </Group>
              ) : null}

              {groups.zherodius.length ? (
                <Group title="Zherodius devices">
                  {groups.zherodius.map((d) => (
                    <Row
                      key={d.key}
                      device={d}
                      state={added[d.key] ? { status: "done", message: "✓ Added" } : undefined}
                      action={
                        added[d.key] ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              finish();
                              props.onDeviceAdded(added[d.key]!);
                            }}
                          >
                            Open
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setPairing(d);
                              setStage("zherodius");
                            }}
                          >
                            Add
                          </Button>
                        )
                      }
                    />
                  ))}
                </Group>
              ) : null}

              {groups.cameras.length ? (
                <Group title="Cameras and doorbells">
                  {groups.cameras.map((d) => (
                    <Row
                      key={d.key}
                      device={d}
                      action={
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            finish();
                            props.onAddCamera(d.address ?? undefined);
                          }}
                        >
                          Add camera
                        </Button>
                      }
                    />
                  ))}
                </Group>
              ) : null}
              {groups.existing.length ? (
                <Stack gap={1}>
                  <ButtonRow>
                    <Button variant="outlined" onClick={() => setShowExisting((v) => !v)}>
                      {showExisting ? "Hide" : "Show"}{" "}
                      {groups.existing.length === 1 ? "1 device" : `${groups.existing.length} devices`} already in Nexternel
                    </Button>
                  </ButtonRow>
                  <Collapse in={showExisting} unmountOnExit>
                    <Stack gap={1}>
                      {groups.existing.map((d) => (
                        <Row
                          key={d.key}
                          device={d}
                          dim
                          action={
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                finish();
                                props.onOpenExisting(d);
                              }}
                            >
                              Open
                            </Button>
                          }
                        />
                      ))}
                    </Stack>
                  </Collapse>
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        {stage === "results" ? (
          <>
            <Button onClick={reset} disabled={bringing}>
              Back
            </Button>
            <Button onClick={() => void search()} disabled={bringing}>
              Search again
            </Button>
            {groups.ready.length ? (
              <Button variant="contained" onClick={() => void bringIn(chosen)} disabled={bringing || chosen.length === 0}>
                {bringing
                  ? "Bringing in…"
                  : chosen.length === 1
                    ? "Bring in 1 device"
                    : `Bring in ${chosen.length} devices`}
              </Button>
            ) : (
              // Nothing to bring in from here: each device is added on its own row, so Close is not the main step.
              <Button onClick={finish}>Close</Button>
            )}
          </>
        ) : stage === "start" ? (
          <Button onClick={finish}>Cancel</Button>
        ) : stage === "zherodius" || stage === "paired" ? null : (
          <Button onClick={close}>Close</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
