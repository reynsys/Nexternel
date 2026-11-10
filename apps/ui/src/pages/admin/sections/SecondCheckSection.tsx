import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api, type TrustedScreen } from "../../../api";
import { ButtonRow } from "../../../components/ButtonRow";
import { copyTextToClipboard } from "../../../lib/copyText";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";
import { MIN_PASSWORD_LENGTH } from "@nexternel/domain";

type Setup = { key: string; accountName: string; link: string; qrSvg: string };

/** A phone or tablet: the QR code would be on the same screen as the camera, so it is not offered first. */
function onPhone(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1024px)").matches;
  } catch {
    return false;
  }
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * My profile → Second check (two-step sign-in), optional. Asked only when signing in from outside.
 * Today: the Authenticator app. Email codes come with Nexternel Anywhere.
 */
export function SecondCheckSection() {
  const surfaceSx = useContentSurfaceSx();
  const [state, setState] = useState<"off" | "on" | "broken" | null>(null);
  const [trusted, setTrusted] = useState<TrustedScreen[]>([]);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [code, setCode] = useState("");
  const [turningOff, setTurningOff] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = onPhone();

  async function load() {
    try {
      const r = await api.secondCheck();
      setState(r.state);
      setTrusted(r.trusted);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load the second check");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function begin() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      setSetup(await api.secondCheckStart());
      setShowQr(!phone);
      setCode("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.secondCheckConfirm(code);
      setSetup(null);
      setMsg("The second check is on. Next time you sign in from outside the home, Nexternel asks for the code.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That code is not right");
    } finally {
      setBusy(false);
    }
  }

  async function off(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.secondCheckOff(password, code || undefined);
      setTurningOff(false);
      setPassword("");
      setCode("");
      setMsg(`The second check is off. Signing in from outside now needs a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not turn it off");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.removeTrustedScreen(id);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not remove it");
    }
  }

  async function copyKey() {
    if (!setup) return;
    const r = await copyTextToClipboard(setup.key.replace(/\s/g, ""));
    setCopied(r.ok);
  }

  if (state === null) return null;

  const qr = setup ? (
    <Box
      component="img"
      alt="QR code for the Authenticator app"
      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrSvg)}`}
      sx={{ width: 200, height: 200, bgcolor: "common.white", borderRadius: 2, p: 1, alignSelf: "center" }}
    />
  ) : null;

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Second check</Typography>
            <Chip
              size="small"
              variant="outlined"
              color={state === "on" ? "success" : state === "broken" ? "warning" : "default"}
              label={state === "on" ? "On" : state === "broken" ? "Set up again" : "Off"}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            When you sign in from outside the home, Nexternel also asks for a 6-digit code from the Authenticator app on
            your phone. Someone who guesses your password still cannot get in. At home nothing changes.
          </Typography>
          {state === "broken" && (
            <Alert severity="warning">
              Nexternel was moved to another server, so the second check has to be set up again. Until then, signing in from
              outside is refused.
            </Alert>
          )}
          {err && <Alert severity="error">{err}</Alert>}
          {msg && <Alert severity="success">{msg}</Alert>}

          {state !== "on" && !setup && (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Without it, signing in from outside needs a password of at least {MIN_PASSWORD_LENGTH} characters. Install Google or Microsoft
                Authenticator on your phone first (free).
              </Typography>
              <Button variant="contained" onClick={() => void begin()} disabled={busy} sx={{ alignSelf: "flex-start" }}>
                Turn on with the Authenticator app
              </Button>
              <Typography variant="caption" color="text.secondary">
                A code by email, as a back-up for a lost phone, comes with Nexternel Anywhere.
              </Typography>
            </Stack>
          )}

          {setup && (
            <Stack component="form" spacing={2} onSubmit={(e) => void confirm(e)}>
              {phone ? (
                <Stack spacing={0.75}>
                  <Button variant="contained" component="a" href={setup.link} sx={{ alignSelf: "stretch" }}>
                    Add to my Authenticator app
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Opens the app with Nexternel already filled in.
                  </Typography>
                </Stack>
              ) : (
                <>
                  <Typography variant="body2">
                    Open Google or Microsoft Authenticator on your phone, tap <b>+</b> and scan this code:
                  </Typography>
                  {qr}
                </>
              )}
              <Box sx={{ border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2, p: 1.5 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">{phone ? "Button did not work? Type it in" : "Cannot scan? Type it in"}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    In the app tap <b>+</b>, then <b>Enter a setup key</b> (Google) or <b>Other account</b> →{" "}
                    <b>Enter code manually</b> (Microsoft).
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Account name: <b>{setup.accountName}</b>
                  </Typography>
                  <ButtonRow>
                    <Typography component="span" variant="subtitle1" sx={{ letterSpacing: 2, flex: 1, minWidth: 0 }}>
                      {setup.key}
                    </Typography>
                    <Button variant="outlined" size="small" onClick={() => void copyKey()}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </ButtonRow>
                  <Typography variant="body2" color="text.secondary">
                    Type of key: <b>Time based</b>
                  </Typography>
                </Stack>
              </Box>
              {phone && (
                <Stack spacing={1}>
                  <Button variant="outlined" size="small" onClick={() => setShowQr((v) => !v)} sx={{ alignSelf: "flex-start" }}>
                    {showQr ? "Hide QR code" : "Show QR code for another phone"}
                  </Button>
                  <Collapse in={showQr}>{qr}</Collapse>
                </Stack>
              )}
              <TextField
                label="Then type the 6-digit code the app shows"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
                autoComplete="one-time-code"
                required
                fullWidth
                slotProps={{ htmlInput: { inputMode: "numeric", style: { letterSpacing: 6, textAlign: "center" } } }}
              />
              <ButtonRow>
                <Button type="submit" variant="contained" disabled={busy}>
                  Check and turn on
                </Button>
                <Button variant="outlined" onClick={() => setSetup(null)} disabled={busy}>
                  Cancel
                </Button>
              </ButtonRow>
            </Stack>
          )}

          {state === "on" && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">Trusted phones</Typography>
              {trusted.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  None. When you sign in from outside, tick "Trust this phone" to skip the code next time on that phone.
                </Typography>
              ) : (
                trusted.map((t) => (
                  <ButtonRow key={t.id} sx={{ justifyContent: "space-between" }}>
                    <Typography variant="body2">
                      {t.label} · trusted {when(t.trustedAt)} · last used {when(t.lastUsedAt)}
                    </Typography>
                    <Button variant="outlined" size="small" onClick={() => void remove(t.id)}>
                      Remove
                    </Button>
                  </ButtonRow>
                ))
              )}
              <Typography variant="caption" color="text.secondary">
                A phone not used for 90 days is forgotten. Sign out everywhere else and a new password forget them all.
              </Typography>
              {!turningOff ? (
                <Button variant="outlined" color="error" onClick={() => setTurningOff(true)} sx={{ alignSelf: "flex-start" }}>
                  Turn off the second check
                </Button>
              ) : (
                <Stack component="form" spacing={1.5} onSubmit={(e) => void off(e)}>
                  <TextField
                    label="Your password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Code from the app (needed when you are outside the home)"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 7))}
                    autoComplete="one-time-code"
                    fullWidth
                    slotProps={{ htmlInput: { inputMode: "numeric" } }}
                  />
                  <ButtonRow>
                    <Button type="submit" variant="contained" color="error" disabled={busy}>
                      Turn off
                    </Button>
                    <Button variant="outlined" onClick={() => setTurningOff(false)} disabled={busy}>
                      Cancel
                    </Button>
                  </ButtonRow>
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
