import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, FormControl, InputLabel, Link, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { KIND_WORD, deviceKind } from "./DeviceBits";
import type { FoundDevice } from "@nexternel/domain";
import { api, type DeviceReplaceCandidate } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { AREA } from "../../../lib/area-labels";
import { insetSx } from "../../../skins/surfaceStyles";

/** What pairing gave: the new device, and whether its line is open. */
export type Paired = { deviceId: string; name: string; online: boolean; switches: number; readings: number };

type Props = {
  /** The device to pair; with `alreadyIn` it is paired again and keeps its place, panels and history. */
  device: Pick<FoundDevice, "name" | "address" | "alreadyIn">;
  areas: { id: string; name: string }[];
  onBack: () => void;
  onPaired: (paired: Paired) => void;
};

/** The code as typed has 8 letters and numbers (a dash or spaces between them are fine). */
const codeLength = (code: string) => code.replace(/[^0-9A-Za-z]/g, "").length;

/**
 * Add a Zherodius device that Search my home found: the owner opens pairing on the device's own page,
 * types the code shown there, and picks an area. The device then comes in with its own name.
 * Pair again (a device already in Nexternel that no longer accepts it): the same steps, no area to pick;
 * the device stays the same one in Nexternel.
 */
export function ZherodiusPairing({ device, areas, onBack, onPaired }: Props) {
  const [code, setCode] = useState("");
  const [areaId, setAreaId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = codeLength(code) === 8;
  const again = Boolean(device.alreadyIn);

  async function pair() {
    if (!device.address || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.zherodiusPair({ address: device.address, code, roomId: areaId || null });
      onPaired({ deviceId: r.deviceId, name: r.name, online: r.online, switches: r.switches, readings: r.readings });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack
      component="form"
      gap={2}
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        void pair();
      }}
    >
      <Box sx={[{ px: 1.75, py: 1.25 }, insetSx()]}>
        <Typography fontWeight="fontWeightMedium">{device.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          Zherodius device{device.address ? ` · IP address ${device.address}` : ""}
        </Typography>
      </Box>
      {again ? (
        <Typography variant="body2" color="text.secondary">
          This device no longer accepts this Nexternel. Pairing it again keeps it as “{device.alreadyIn!.name}”, with its {AREA.singular.toLowerCase()}, panels and history.
        </Typography>
      ) : null}

      <Stack component="ol" gap={1} sx={{ m: 0, pl: 2.5 }}>
        <Typography component="li">
          Open the device's own page{device.address ? (
            <>
              {" "}
              (
              <Link href={`http://${device.address}/`} target="_blank" rel="noreferrer">
                {device.address}
              </Link>
              )
            </>
          ) : null}{" "}
          and sign in.
        </Typography>
        <Typography component="li">Go to Settings → Nexternel and press Pair with Nexternel.</Typography>
        <Typography component="li">Type the pairing code it shows here. The code works for 5 minutes.</Typography>
      </Stack>

      <TextField
        id="zherodius-pairing-code"
        label="Pairing code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputProps={{ maxLength: 12, autoCapitalize: "characters", autoCorrect: "off", spellCheck: false }}
        autoComplete="off"
        autoFocus
        fullWidth
      />
      {again ? null : (
      <FormControl fullWidth>
        <InputLabel id="zherodius-pairing-area">{AREA.singular}</InputLabel>
        <Select labelId="zherodius-pairing-area" label={AREA.singular} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <MenuItem value="">No {AREA.singular.toLowerCase()}</MenuItem>
          {areas.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {a.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      )}
      {error ? (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      ) : null}
      <ButtonRow justifyContent="space-between">
        <Button onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button type="submit" variant="contained" disabled={busy || !ready || !device.address}>
          {busy ? "Pairing…" : again ? "Pair again" : "Pair and add"}
        </Button>
      </ButtonRow>
    </Stack>
  );
}

/** "1 item keeps its panels and names" / "4 items keep their panels and names". */
function keep(n: number): string {
  return n === 1 ? "1 item keeps its panels and names" : `${n} items keep their panels and names`;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What the device brought in, in words: "Online · 4 switches · 2 readings". */
function brought(p: Paired): string {
  const parts = [p.online ? "Online" : "Not connected yet"];
  if (p.switches) parts.push(count(p.switches, "switch", "switches"));
  if (p.readings) parts.push(count(p.readings, "reading", "readings"));
  return parts.join(" · ");
}

/** One earlier device this one may replace. */
function ReplaceOffer({ paired, candidate, onDone }: { paired: Paired; candidate: DeviceReplaceCandidate; onDone: (words: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kindWord = KIND_WORD[deviceKind(candidate)];
  const moving = candidate.moved.length;
  async function replace() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.deviceReplace(paired.deviceId, candidate.deviceId);
      onDone(`Replaced the earlier ${candidate.name}: ${keep(r.moved)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The earlier device could not be replaced.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap={1.25} sx={[{ p: 1.75 }, insetSx()]}>
      <Typography fontWeight="fontWeightMedium">
        Does this replace the earlier {candidate.name} ({kindWord})?
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Nexternel already has a device called {candidate.name}
        {candidate.online ? "" : " that is not answering"}. If the new one takes its place,{" "}
        {moving ? `${keep(moving)} on the new device` : "none of its items match the new device"}, and the earlier one is removed.
      </Typography>
      {candidate.missing.length ? (
        <Typography variant="body2" color="warning.main">
          Not on the new device, so removed with the earlier one: {candidate.missing.map((m) => m.name).join(", ")}.
        </Typography>
      ) : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      <ButtonRow justifyContent="space-between">
        <Button onClick={() => onDone("")} disabled={busy}>
          Keep both devices
        </Button>
        <Button variant="contained" onClick={() => void replace()} disabled={busy}>
          {busy ? "Replacing…" : "Replace the earlier device"}
        </Button>
      </ButtonRow>
    </Stack>
  );
}

/** After pairing: what came in, and (when an earlier device has the same name) whether it replaces it. */
export function ZherodiusPaired({ paired, onOpen, onAddAnother }: { paired: Paired; onOpen: () => void; onAddAnother: () => void }) {
  const [candidates, setCandidates] = useState<DeviceReplaceCandidate[] | null>(null);
  const [answered, setAnswered] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    api
      .deviceReplaceCandidates(paired.deviceId)
      .then((r) => live && setCandidates(r.candidates))
      .catch(() => live && setCandidates([]));
    return () => {
      live = false;
    };
  }, [paired.deviceId]);
  const open = (candidates ?? []).filter((c) => answered[c.deviceId] === undefined);
  return (
    <Stack gap={2}>
      <Stack direction="row" gap={1.5} alignItems="center" sx={[{ px: 1.75, py: 1.25 }, insetSx()]}>
        <CheckCircleIcon color="success" />
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight="fontWeightMedium">{paired.name} is in Nexternel</Typography>
          <Typography variant="body2" color="text.secondary">
            {brought(paired)}
          </Typography>
        </Box>
      </Stack>
      {candidates === null ? <CircularProgress size={20} /> : null}
      {Object.values(answered)
        .filter(Boolean)
        .map((words) => (
          <Alert key={words} severity="success">
            {words}
          </Alert>
        ))}
      {open.map((c) => (
        <ReplaceOffer key={c.deviceId} paired={paired} candidate={c} onDone={(words) => setAnswered((a) => ({ ...a, [c.deviceId]: words }))} />
      ))}
      <ButtonRow justifyContent="space-between">
        <Button onClick={onAddAnother} disabled={open.length > 0}>
          Add another
        </Button>
        <Button variant="contained" onClick={onOpen} disabled={open.length > 0}>
          Open {paired.name}
        </Button>
      </ButtonRow>
    </Stack>
  );
}
