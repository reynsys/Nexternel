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
import type { FoundDevice } from "@nexternel/domain";
import { api } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { insetSx } from "../../../skins/surfaceStyles";
import { DevicesWifiExplainer, DevicesWifiForm } from "../../../components/DevicesWifi";

/** What happens to one device while it is being brought in. */
export type BringInState = { status: "working" | "done" | "failed" | "password" | "wifi"; message?: string };

export type AddDeviceDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Add one yourself. */
  onAddBoard: () => void;
  onAddShelly: () => void;
  onAddCamera: (host?: string) => void;
  /** Open a device or camera Nexternel already has. */
  onOpenExisting: (found: FoundDevice) => void;
  /** Bring the ticked devices in; reports each device as it goes (password: the device's own, when it has one). */
  onBringIn: (
    devices: FoundDevice[],
    report: (key: string, state: BringInState) => void,
    password?: string
  ) => Promise<void>;
};

type Stage = "start" | "searching" | "results";

/** The plain sentence that says what bringing this device in does. */
export function bringInSentence(d: FoundDevice): string {
  switch (d.kind) {
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
 * Devices → Add device. "Search my home" looks around the home network and lists what it finds,
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

  const groups = useMemo(() => {
    const ready = found.filter(canBringIn);
    const cameras = found.filter((d) => d.kind === "camera" && !d.alreadyIn);
    const existing = found.filter((d) => d.alreadyIn);
    const others = found.filter((d) => !d.alreadyIn && !canBringIn(d) && d.kind !== "camera");
    return { ready, cameras, existing, others };
  }, [found]);

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
  }

  function close() {
    if (bringing) return;
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
      setError(err instanceof Error ? err.message : "The search of your home network didn't finish. Try again.");
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

  const addYourself = (
    <Stack gap={1}>
      <Typography variant="subtitle1">Or add one yourself</Typography>
      <ButtonRow direction="column" alignItems="stretch">
      {[
        { title: "ESPHome board", text: "An ESP32 or ESP8266 board. Nexternel makes and installs its board software.", go: props.onAddBoard },
        { title: "Shelly switch", text: "A Shelly switch or plug", go: props.onAddShelly },
        { title: "Camera", text: "A network camera's live picture", go: () => props.onAddCamera() },
      ].map((o) => (
        <Button
          key={o.title}
          variant="outlined"
          fullWidth
          sx={{ justifyContent: "flex-start", textAlign: "left", py: 1.25, px: 2 }}
          onClick={() => {
            close();
            o.go();
          }}
        >
          <Stack alignItems="flex-start" spacing={0.25}>
            <Typography fontWeight="fontWeightBold">{o.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {o.text}
            </Typography>
          </Stack>
        </Button>
      ))}
      </ButtonRow>
      <Typography variant="caption" color="text.secondary">
        Online services such as Octopus energy are set up in their own settings. More kinds of devices come as Extensions
        (Extensions → Manage extensions).
      </Typography>
    </Stack>
  );

  return (
    <Dialog open={props.open} onClose={close} fullWidth maxWidth={stage === "results" ? "sm" : "xs"}>
      <DialogTitle>Add device</DialogTitle>
      <DialogContent>
        <Stack gap={2.5} sx={{ mt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          {stage === "start" ? (
            <>
              <Stack gap={1.25}>
                <Typography variant="subtitle1">Already have smart devices at home?</Typography>
                <Typography variant="body2" color="text.secondary">
                  Nexternel can look around your home network and show what it finds. Nothing changes until you choose.
                </Typography>
                <ButtonRow>
                  <Button variant="contained" startIcon={<SearchIcon />} onClick={() => void search()}>
                    Search my home
                  </Button>
                </ButtonRow>
              </Stack>
              {addYourself}
            </>
          ) : null}

          {stage === "searching" ? (
            <Stack direction="row" gap={1.5} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={22} />
              <Typography>Looking around your home network… this takes about 5 seconds.</Typography>
            </Stack>
          ) : null}

          {stage === "results" ? (
            <>
              <Typography variant="body2" color="text.secondary">
                {found.length === 0
                  ? "Nothing answered on your home network. Devices that are switched off, or on a different Wi-Fi network, can't be found."
                  : `Found ${found.length === 1 ? "1 device" : `${found.length} devices`}.`}
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
                            close();
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

              {groups.others.length ? (
                <Group title="Also on your network" note="Listed so nothing is hidden. They stay as they are.">
                  {groups.others.map((d) => (
                    <Row key={d.key} device={d} dim />
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
                                close();
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
              <Button variant="contained" onClick={close}>
                Done
              </Button>
            )}
          </>
        ) : (
          <Button onClick={close}>Cancel</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
