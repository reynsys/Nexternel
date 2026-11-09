import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  InputAdornment,
  Link,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api, type AnywhereView } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { copyTextToClipboard } from "../../../lib/copyText";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { CODE_TEXT } from "../../../lib/appearance/type";

/** A phone or tablet: the QR code would be on the same screen as the camera, so it is not shown. */
function onPhone(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1024px)").matches;
  } catch {
    return false;
  }
}

/** The light's colour, the same here and in the menu (components/AnywhereStatus.tsx). */
export const LIGHT_COLOUR: Record<AnywhereView["light"], string> = {
  green: "success.main",
  orange: "warning.main",
  red: "error.main",
  off: "text.disabled",
};

type Check = { name: string; free: boolean; problem: string | null; suggestions: string[] };

/** Choosing the name: says while typing whether it is free, offers free ones when not. */
function NameChooser({
  domain,
  current,
  onDone,
  onCancel,
}: {
  domain: string;
  current: string | null;
  onDone: (v: AnywhereView) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const clean = name.trim().toLowerCase();

  useEffect(() => {
    setCheck(null);
    setErr(null);
    if (!clean) return;
    setChecking(true);
    const t = setTimeout(() => {
      api
        .checkAnywhereName(clean)
        .then((c) => setCheck(c.name === clean ? c : null))
        .catch((e) => setErr(e instanceof Error ? e.message : "Could not check the name"))
        .finally(() => setChecking(false));
    }, 450);
    return () => clearTimeout(t);
  }, [clean]);

  async function take() {
    setBusy(true);
    setErr(null);
    try {
      onDone(await api.claimAnywhereName(clean));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not take the name");
    } finally {
      setBusy(false);
    }
  }

  const ok = check?.free && clean !== current;
  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">{current ? "New name" : "Choose your name"}</Typography>
      <TextField
        value={name}
        onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        placeholder="smith"
        size="small"
        autoComplete="off"
        inputProps={{ maxLength: 32, "aria-label": "Name for your address" }}
        InputProps={{ endAdornment: <InputAdornment position="end">{domain}</InputAdornment> }}
        sx={{ maxWidth: 420 }}
        error={Boolean(check && !check.free)}
        helperText={
          !clean
            ? "Small letters, digits and dashes. It becomes your address, so choose something you will remember."
            : checking
              ? "Checking…"
              : check?.free
                ? clean === current
                  ? "This is your name now."
                  : `Free. Your address will be https://${clean}${domain}`
                : check?.problem ?? " "
        }
      />
      {check && !check.free && check.suggestions.length > 0 ? (
        <ButtonRow>
          <Typography variant="body2" color="text.secondary">
            Free:
          </Typography>
          {check.suggestions.map((s) => (
            <Chip key={s} label={s} variant="outlined" onClick={() => setName(s)} />
          ))}
        </ButtonRow>
      ) : null}
      {current ? (
        <Typography variant="body2" color="text.secondary">
          Your old address stops working at once, and phones need the new one. GPS trackers keep working without any change.
        </Typography>
      ) : null}
      {err ? <Alert severity="error">{err}</Alert> : null}
      <ButtonRow>
        <Button variant="contained" disabled={!ok || busy} onClick={() => void take()}>
          Use this name
        </Button>
        {onCancel ? (
          <Button variant="outlined" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        ) : null}
      </ButtonRow>
    </Stack>
  );
}

/** Where this home's GPS trackers send their positions, and the text message that sets a SinoTrack tracker. */
function GpsTarget({ gps }: { gps: NonNullable<AnywhereView["gps"]> }) {
  const [copied, setCopied] = useState(false);
  const sms = `8040000 ${gps.host} ${gps.port}`;
  async function copy() {
    const r = await copyTextToClipboard(sms);
    setCopied(r.ok);
    if (r.ok) setTimeout(() => setCopied(false), 2_000);
  }
  return (
    <Box>
      <Typography variant="subtitle2">GPS trackers</Typography>
      <Typography variant="body2" color="text.secondary">
        Works with most trackers (SinoTrack, Concox, Teltonika, Coban, TK103, GPS watches) and with tracker apps on
        a phone. Set your tracker to send its positions to:
      </Typography>
      <Box component="dl" sx={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 2, rowGap: 0.25, my: 1 }}>
        <Typography component="dt" variant="body2" color="text.secondary">
          Server
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, wordBreak: "break-all" }}>
          {gps.host}
        </Typography>
        <Typography component="dt" variant="body2" color="text.secondary">
          Port
        </Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0 }}>
          {gps.port}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        SinoTrack tracker: send this text message to the tracker's phone number.
      </Typography>
      <ButtonRow>
        <Typography variant="body1" sx={{ ...CODE_TEXT, wordBreak: "break-all" }}>
          {sms}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </ButtonRow>
      <Typography variant="body2" color="text.secondary">
        0000 is the tracker's password from the factory. If you changed it, use yours instead of 0000.
      </Typography>
      {gps.ip ? (
        <Typography variant="body2" color="text.secondary">
          If your tracker does not accept a name, use {gps.ip} instead of {gps.host}.
        </Typography>
      ) : null}
    </Box>
  );
}

/**
 * Settings → System → Nexternel Anywhere: open Nexternel away from home (mobile data, other Wi-Fi),
 * with the padlock and no router changes. Switch, light, address and a QR code for the phone.
 */
export function AnywhereCard() {
  const surfaceSx = useContentSurfaceSx();
  const [view, setView] = useState<AnywhereView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [changing, setChanging] = useState(false);
  // Opened from the menu's Nexternel Anywhere line: bring this card into view once it has loaded.
  const loaded = Boolean(view);
  useEffect(() => {
    if (loaded && window.location.hash === "#nexternel-anywhere") document.getElementById("nexternel-anywhere")?.scrollIntoView({ block: "start" });
  }, [loaded]);
  const phone = onPhone();

  async function load() {
    try {
      setView(await api.anywhere());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load Nexternel Anywhere");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // While it is getting ready, look again often; otherwise now and then.
  useEffect(() => {
    if (!view) return;
    const t = setInterval(() => void load(), view.light === "orange" ? 4_000 : 30_000);
    return () => clearInterval(t);
  }, [view?.light]);

  async function toggle(on: boolean) {
    setBusy(true);
    setErr(null);
    try {
      setView(await api.setAnywhere(on));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not change it");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!view?.address) return;
    const r = await copyTextToClipboard(view.address);
    setCopied(r.ok);
    if (r.ok) setTimeout(() => setCopied(false), 2_000);
  }

  if (!view && !err) return null;
  const ready = view?.enabled && view.light === "green";

  return (
    <Card id="nexternel-anywhere" sx={{ ...surfaceSx, scrollMarginTop: 80 }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Nexternel Anywhere</Typography>
            {view?.setUp ? (
              <Switch
                checked={view.enabled}
                disabled={busy}
                onChange={(e) => void toggle(e.target.checked)}
                inputProps={{ "aria-label": "Nexternel Anywhere on or off" }}
              />
            ) : null}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Open Nexternel away from home, on mobile data or any Wi-Fi, with the padlock. Nothing changes on your router.
            Switches and readings at home keep working without it.
          </Typography>
          {err ? <Alert severity="error">{err}</Alert> : null}

          {view ? (
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                aria-hidden
                sx={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, bgcolor: LIGHT_COLOUR[view.light] }}
              />
              <Typography variant="body2" fontWeight="fontWeightMedium">
                {view.text}
              </Typography>
            </Stack>
          ) : null}

          {view && !view.setUp && !view.licensed ? (
            <Typography variant="body2">
              Nexternel Anywhere is a paid service. Add its licence key in Settings → Extensions, then choose your name here.
            </Typography>
          ) : null}

          {view && !view.setUp && view.licensed ? (
            <NameChooser domain={view.domain} current={null} onDone={setView} />
          ) : null}

          {view?.setUp && view.address ? (
            <Box>
              <Typography variant="subtitle2">Your address</Typography>
              <ButtonRow>
                <Typography variant="body1" sx={{ wordBreak: "break-all" }}>
                  {ready ? <Link href={view.address}>{view.address}</Link> : view.address}
                </Typography>
                <Button size="small" variant="outlined" onClick={() => void copy()}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                {view.licensed && !changing ? (
                  <Button size="small" variant="outlined" onClick={() => setChanging(true)}>
                    Change name
                  </Button>
                ) : null}
              </ButtonRow>
            </Box>
          ) : null}

          {view?.setUp && changing ? (
            <NameChooser
              domain={view.domain}
              current={view.name}
              onDone={(v) => {
                setView(v);
                setChanging(false);
              }}
              onCancel={() => setChanging(false)}
            />
          ) : null}

          {ready && view?.qrSvg ? (
            phone ? (
              <Typography variant="body2" color="text.secondary">
                Open the address on this phone, then add a shortcut to your home screen from the browser menu. iPhone:
                Share → Add to Home Screen. Android: ⋮ → Add to Home screen.
              </Typography>
            ) : (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Box
                  component="img"
                  alt="QR code of your Nexternel Anywhere address"
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(view.qrSvg)}`}
                  sx={{ width: 160, height: 160, bgcolor: "common.white", borderRadius: 2, p: 1, flexShrink: 0 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Point your phone's camera at the code to open your address. Then add a shortcut to your home screen from
                  the browser menu. iPhone: Share → Add to Home Screen. Android: ⋮ → Add to Home screen.
                </Typography>
              </Stack>
            )
          ) : null}

          {view?.gps ? <GpsTarget gps={view.gps} /> : null}

          {view?.enabled ? (
            <Typography variant="caption" color="text.secondary">
              Signing in from outside asks for the second check if it is on in My profile.
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
