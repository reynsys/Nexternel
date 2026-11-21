import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { ChoiceTile } from "../../../skins/ThemePresetTile";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { FoundDevice } from "@nexternel/domain";
import { api } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { DevicesWifiExplainer, DevicesWifiForm } from "../../../components/DevicesWifi";
import { AREA } from "../../../lib/area-labels";
import { copyTextToClipboard } from "../../../lib/copyText";
import { insetSx } from "../../../skins/surfaceStyles";

/** The address every new Shelly answers on while it shows its own Wi-Fi network. */
export const SHELLY_SETUP_ADDRESS = "192.168.33.1";

/** How long step 4 keeps looking before it offers help. */
const LOOK_FOR_MS = 3 * 60_000;

export type ShellyGuideStep = 1 | 2 | 3 | 4;

export type ShellyGuideProps = {
  step: ShellyGuideStep;
  onStep: (step: ShellyGuideStep) => void;
  areas: { id: string; name: string }[];
  /** Back to the list of device kinds. */
  onLeave: () => void;
  /** The Shelly is in Nexternel and has been tried: close the window and show it. */
  onFinished: (deviceId: string) => void;
};

function StepDots(props: { step: ShellyGuideStep }) {
  return (
    <Stack direction="row" gap={0.75} alignItems="center" aria-label={`Step ${props.step} of 4`}>
      {[1, 2, 3, 4].map((n) => (
        <Box
          key={n}
          sx={(t) => ({
            width: 28,
            height: 4,
            borderRadius: 2,
            bgcolor: n <= props.step ? t.palette.primary.main : t.palette.divider,
          })}
        />
      ))}
      <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
        Step {props.step} of 4
      </Typography>
    </Stack>
  );
}

function Steps(props: { children: React.ReactNode[] }) {
  return (
    <Stack component="ol" gap={1.25} sx={{ m: 0, p: 0, listStyle: "none" }}>
      {props.children.map((c, i) => (
        <Stack component="li" key={i} direction="row" gap={1.25} alignItems="flex-start">
          <Typography
            aria-hidden
            variant="body2"
            fontWeight="fontWeightBold"
            sx={(t) => ({
              flex: "none",
              width: 26,
              height: 26,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              border: `1px solid ${t.palette.divider}`,
            })}
          >
            {i + 1}
          </Typography>
          <Typography sx={{ pt: 0.25, minWidth: 0 }}>{c}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * Add device → Shelly: a brand-new Shelly in four steps. The owner gives the Shelly the home Wi-Fi
 * on its own page (the way Shelly sets up new devices); Nexternel then finds it on the home network
 * and brings it in with the name and area chosen here.
 */
export function ShellyGuide(props: ShellyGuideProps) {
  const { step, onStep } = props;
  return (
    <Stack gap={2.5}>
      <StepDots step={step} />
      {step === 1 ? <StepPowerOn /> : null}
      {step === 2 ? <StepJoinShellyWifi /> : null}
      {step === 3 ? <StepGiveHomeWifi /> : null}
      {step === 4 ? <StepFind areas={props.areas} onRestart={() => onStep(1)} onFinished={props.onFinished} /> : null}
      {step < 4 ? (
        <ButtonRow justifyContent="space-between">
          <Button onClick={() => (step === 1 ? props.onLeave() : onStep((step - 1) as ShellyGuideStep))}>Back</Button>
          <Button variant="contained" onClick={() => onStep((step + 1) as ShellyGuideStep)}>
            {step === 3 ? "Find my Shelly" : "Next"}
          </Button>
        </ButtonRow>
      ) : null}
    </Stack>
  );
}

function StepPowerOn() {
  return (
    <Stack gap={2}>
      <Typography variant="h6">Power on the Shelly</Typography>
      <Steps>
        {[
          "Wire it up or plug it in, and switch the power on.",
          "A new Shelly makes its own small Wi-Fi network for about 15 minutes, so you can set it up.",
        ]}
      </Steps>
      <Typography variant="body2" color="text.secondary">
        Used before, or set up with Shelly's app? If it's already on this network, go back and use Search this network instead. To
        start a Shelly fresh, hold its button for 10 seconds.
      </Typography>
    </Stack>
  );
}

function StepJoinShellyWifi() {
  return (
    <Stack gap={2}>
      <Typography variant="h6">Join the Shelly's Wi-Fi</Typography>
      <Steps>
        {[
          "On your phone, open the Wi-Fi list.",
          <>
            Tap the network whose name starts with <b>shelly</b>. It has no password.
          </>,
          <>
            If the phone warns there is no internet, choose <b>stay connected</b>.
          </>,
        ]}
      </Steps>
    </Stack>
  );
}

function StepGiveHomeWifi() {
  const [wifi, setWifi] = useState<{ ssid: string | null; passwordSet: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function loadWifi() {
    void api
      .devicesWifi()
      .then(setWifi)
      .catch(() => setWifi({ ssid: null, passwordSet: false }));
  }
  useEffect(loadWifi, []);

  async function copy() {
    const res = await copyTextToClipboard(SHELLY_SETUP_ADDRESS);
    setCopied(res.ok ? "Copied" : "Copy it by hand");
  }

  if (!wifi) return <CircularProgress size={22} />;

  if (!wifi.ssid || !wifi.passwordSet) {
    return (
      <Stack gap={2}>
        <Typography variant="h6">First: which Wi-Fi do your devices use?</Typography>
        <DevicesWifiExplainer />
        <DevicesWifiForm idPrefix="shelly-guide-wifi" saveLabel="Save" onSaved={loadWifi} />
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      <Typography variant="h6">Give the Shelly the Wi-Fi it will use</Typography>
      <Typography color="text.secondary">Open this address in your phone's browser:</Typography>
      <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap" sx={[{ px: 1.75, py: 1.25 }, insetSx()]}>
        <Typography component="code" variant="h5">
          {SHELLY_SETUP_ADDRESS}
        </Typography>
        <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={() => void copy()}>
          {copied ?? "Copy"}
        </Button>
      </Stack>
      <Steps>
        {[
          <>
            On the Shelly's page, open the Wi-Fi settings. Newer Shellys: <b>Settings → Wi-Fi</b>. Older ones:{" "}
            <b>Internet &amp; Security → Wi-Fi Mode – Client</b>.
          </>,
          <>
            Choose <b>{wifi.ssid}</b> and type its password. That's the Wi-Fi set for your devices (Devices → Wi-Fi for devices).
          </>,
          <>
            Press <b>Save</b>. Then put your phone back on your usual Wi-Fi.
          </>,
        ]}
      </Steps>
    </Stack>
  );
}

type Added = { deviceId: string; name: string; message: string };

function StepFind(props: { areas: { id: string; name: string }[]; onRestart: () => void; onFinished: (deviceId: string) => void }) {
  const [looking, setLooking] = useState(true);
  const [gaveUp, setGaveUp] = useState(false);
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState("");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const run = useRef(0);

  /** Ask the home network again and again until a Shelly that isn't in Nexternel answers. */
  function look() {
    const mine = ++run.current;
    setLooking(true);
    setGaveUp(false);
    setError(null);
    const until = Date.now() + LOOK_FOR_MS;
    void (async () => {
      while (run.current === mine && Date.now() < until) {
        try {
          const res = await api.homeNetworkSearch();
          if (run.current !== mine) return;
          const shellys = res.devices.filter((d) => d.kind === "shelly" && !d.alreadyIn);
          if (shellys.length) {
            setFound(shellys);
            setChosenKey(shellys[0].key);
            setName(shellys[0].name);
            setLooking(false);
            return;
          }
        } catch (err) {
          if (run.current !== mine) return;
          setError(err instanceof Error ? err.message : "Nexternel couldn't look on this network.");
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (run.current === mine) {
        setLooking(false);
        setGaveUp(true);
      }
    })();
  }

  useEffect(() => {
    look();
    return () => {
      run.current++;
    };
  }, []);

  const chosen = found.find((d) => d.key === chosenKey) ?? null;

  async function add() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.homeNetworkBringIn(chosen, {
        name: name.trim() || undefined,
        roomId: areaId || null,
        password: needPassword && password ? password : undefined,
      });
      setAdded(res);
    } catch (err) {
      const { status } = err as { status?: number };
      if (status === 422) setNeedPassword(true);
      setError(err instanceof Error ? err.message : "Adding it didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (added) return <TryIt added={added} onFinished={props.onFinished} />;

  if (looking) {
    return (
      <Stack gap={2}>
        <Typography variant="h6">Finding your new Shelly</Typography>
        <Stack direction="row" gap={1.5} alignItems="center">
          <CircularProgress size={22} />
          <Typography color="text.secondary">Looking for it on this network… usually under a minute.</Typography>
        </Stack>
        {error ? <Alert severity="warning">{error}</Alert> : null}
      </Stack>
    );
  }

  if (gaveUp) {
    return (
      <Stack gap={2}>
        <Typography variant="h6">Not found after 3 minutes</Typography>
        <Stack gap={0.75} sx={[{ px: 1.75, py: 1.5 }, insetSx()]}>
          <Typography variant="body2">• Check the Wi-Fi password you typed on the Shelly's page.</Typography>
          <Typography variant="body2">• Make sure you chose your devices' Wi-Fi, not a different network.</Typography>
          <Typography variant="body2">
            • Still nothing? Hold the Shelly's button for 10 seconds to start it fresh, then go back to Step 1.
          </Typography>
        </Stack>
        {error ? <Alert severity="warning">{error}</Alert> : null}
        <ButtonRow justifyContent="space-between">
          <Button onClick={props.onRestart}>Start again</Button>
          <Button variant="contained" onClick={look}>
            Keep looking
          </Button>
        </ButtonRow>
      </Stack>
    );
  }

  return (
    <Stack
      component="form"
      gap={2}
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        void add();
      }}
    >
      <Typography variant="h6">{found.length === 1 ? "Found your Shelly" : `Found ${found.length} Shellys`}</Typography>
      {found.length === 1 && chosen ? (
        <Stack direction="row" gap={1.5} alignItems="center" sx={[{ px: 1.75, py: 1.25 }, insetSx()]}>
          <CheckCircleIcon color="success" />
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight="fontWeightMedium">{chosen.what}</Typography>
            <Typography variant="body2" color="text.secondary">
              On this network now
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Pick the new one. The others are already on your Wi-Fi but not in Nexternel.
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 1 }}>
            {found.map((d) => (
              <ChoiceTile
                key={d.key}
                selected={chosenKey === d.key}
                onClick={() => {
                  setChosenKey(d.key);
                  setName(d.name);
                }}
                title={d.name}
                text={d.what}
              />
            ))}
          </Box>
        </Box>
      )}
      <TextField
        id="shelly-guide-name"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Hallway light"
        inputProps={{ maxLength: 100 }}
        fullWidth
      />
      <FormControl fullWidth>
        <InputLabel id="shelly-guide-area">{AREA.singular}</InputLabel>
        <Select labelId="shelly-guide-area" label={AREA.singular} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <MenuItem value="">No {AREA.singular.toLowerCase()}</MenuItem>
          {props.areas.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {needPassword ? (
        <TextField
          id="shelly-guide-password"
          type="password"
          label="The Shelly's own password"
          helperText="This Shelly has a password set on its own page. Type it here, or start the Shelly fresh (hold its button for 10 seconds)."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          fullWidth
        />
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <ButtonRow justifyContent="space-between">
        <Button onClick={look} disabled={busy}>
          Look again
        </Button>
        <Button type="submit" variant="contained" disabled={busy || !chosen || (needPassword && !password)}>
          {busy ? "Adding…" : "Add to Nexternel"}
        </Button>
      </ButtonRow>
    </Stack>
  );
}

/** After adding: wait until the Shelly reports to Nexternel, then let the owner hear it click. */
function TryIt(props: { added: Added; onFinished: (deviceId: string) => void }) {
  const { added } = props;
  const [relayCapability, setRelayCapability] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [waitedOut, setWaitedOut] = useState(false);
  const [trying, setTrying] = useState(false);
  const [tried, setTried] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const until = Date.now() + 60_000;
    void (async () => {
      while (!stop && Date.now() < until) {
        try {
          const res = await api.devices();
          const d = res.devices.find((x) => x.id === added.deviceId);
          const cap = d?.relays.find((r) => r.capabilityId)?.capabilityId ?? null;
          if (d?.isOnline && cap) {
            setRelayCapability(cap);
            setOnline(true);
            return;
          }
        } catch {
          // keep waiting
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!stop) setWaitedOut(true);
    })();
    return () => {
      stop = true;
    };
  }, [added.deviceId]);

  async function tryIt() {
    if (!relayCapability) return;
    setTrying(true);
    setTried(null);
    try {
      await api.command(relayCapability, "on");
      await new Promise((r) => setTimeout(r, 1500));
      await api.command(relayCapability, "off");
      setTried("Did you hear it click on and off? Then it's working.");
    } catch (err) {
      setTried(err instanceof Error ? err.message : "It didn't answer. Check it has power, then try again.");
    } finally {
      setTrying(false);
    }
  }

  return (
    <Stack gap={2}>
      <Stack direction="row" gap={1.5} alignItems="center">
        <CheckCircleIcon color="success" />
        <Typography variant="h6">Added: {added.name}</Typography>
      </Stack>
      <Typography color="text.secondary">{added.message}</Typography>
      {!online && !waitedOut ? (
        <Stack gap={1}>
          <Typography variant="body2">Waiting for it to report to Nexternel…</Typography>
          <LinearProgress />
        </Stack>
      ) : null}
      {waitedOut && !online ? (
        <Alert severity="info">
          It hasn't reported yet. It's in Nexternel, and it will show as online once it has restarted. If it stays offline, switch
          its power off and on.
        </Alert>
      ) : null}
      {online ? (
        <Stack gap={1}>
          <Typography>
            Try it: Nexternel switches it on, then off again after a moment. Anything plugged into it switches too.
          </Typography>
          <ButtonRow>
            <Button variant="outlined" onClick={() => void tryIt()} disabled={trying}>
              {trying ? "Switching…" : "Switch the Shelly on and off"}
            </Button>
          </ButtonRow>
          {tried ? <Typography variant="body2">{tried}</Typography> : null}
        </Stack>
      ) : null}
      <ButtonRow>
        <Button variant="contained" onClick={() => props.onFinished(added.deviceId)}>
          Done
        </Button>
      </ButtonRow>
    </Stack>
  );
}
