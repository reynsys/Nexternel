import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { api, type HttpsStatus } from "../../../api";
import { useConfirm } from "../../../components/confirm";
import { useShellAuth } from "../../../skins/useShellAuth";
import { hasPermission } from "../../../lib/permissions";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

const CERT_NAME = "Nexternel Home Certificate";

/** Short steps for trusting the home certificate on each kind of device. */
const DEVICE_STEPS: { id: string; label: string; steps: string[] }[] = [
  {
    id: "iphone",
    label: "iPhone / iPad",
    steps: [
      "Open the download link in Safari and tap Allow.",
      `Settings → General → VPN & Device Management → ${CERT_NAME} → Install.`,
      `Settings → General → About → Certificate Trust Settings → switch on ${CERT_NAME}.`,
    ],
  },
  {
    id: "android",
    label: "Android",
    steps: [
      "Download the certificate.",
      "Settings → Security (or Security & privacy → More security settings) → Encryption & credentials → Install a certificate → CA certificate.",
      "Tap Install anyway and choose the downloaded file.",
    ],
  },
  {
    id: "windows",
    label: "Windows",
    steps: [
      "Download the certificate and open it.",
      "Install Certificate → Current User → Place all certificates in the following store → Browse → Trusted Root Certification Authorities.",
      "Finish, answer Yes, then restart the browser. (Firefox: Settings → Privacy & Security → View Certificates → Authorities → Import.)",
    ],
  },
  {
    id: "mac",
    label: "Mac",
    steps: [
      "Download the certificate and open it: Keychain Access adds it.",
      `Double-click ${CERT_NAME} → Trust → When using this certificate: Always Trust.`,
      "Close the window and enter your Mac password.",
    ],
  },
  {
    id: "linux",
    label: "Linux",
    steps: [
      "Download the certificate.",
      "Chrome: Settings → Privacy and security → Security → Manage certificates → Authorities → Import (tick: trust for websites).",
      "Firefox: Settings → Privacy & Security → View Certificates → Authorities → Import (tick: trust to identify websites).",
    ],
  },
];

function guessDevice(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iphone";
  if (/Android/.test(ua)) return "android";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh/.test(ua)) return "mac";
  return "linux";
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** Settings → System: https with Nexternel's home certificate, and the owner's own domain. */
export function HttpsCard() {
  const surfaceSx = useContentSurfaceSx();
  const { confirm } = useConfirm();
  const { isAdmin, permissions } = useShellAuth();
  const canManage = hasPermission(permissions, "manageUsers", Boolean(isAdmin));
  const [status, setStatus] = useState<HttpsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [device, setDevice] = useState(guessDevice);
  const [names, setNames] = useState("");
  const [domain, setDomain] = useState("");
  const certFile = useRef<HTMLInputElement>(null);
  const keyFile = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .httpsStatus()
      .then((s) => {
        setStatus(s);
        setNames(s.settings.extraNames.join(", "));
        setDomain(s.settings.domain ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the secure connection settings"));
  }, []);

  async function run(action: () => Promise<HttpsStatus>, done?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const s = await action();
      setStatus(s);
      if (done) setNotice(done);
      return s;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    if (!enabled) {
      const ok = await confirm({
        title: "Switch off the secure connection?",
        message:
          "Nexternel will only be available over plain http (not encrypted), at port 8080. Microphone and other features that need https stop working.",
        confirmLabel: "Switch off",
      });
      if (!ok) return;
    }
    const s = await run(() => api.saveHttps({ enabled }));
    if (!s) return;
    // The page's own address changes: go to the new one.
    const host = window.location.hostname;
    window.location.href = enabled
      ? `https://${host}${s.httpsPort === 443 ? "" : `:${s.httpsPort}`}${window.location.pathname}`
      : `http://${host}:8080${window.location.pathname}`;
  }

  const onHttps = window.location.protocol === "https:";
  const steps = DEVICE_STEPS.find((d) => d.id === device) ?? DEVICE_STEPS[0]!;
  // Before a device trusts the certificate it can still fetch it over plain http.
  const plainLink = `http://${window.location.hostname}:8080/nexternel-home-certificate.crt`;

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Secure connection</Typography>
          {!status ? (
            error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />
          ) : (
            <>
              <Typography variant="body2">
                {status.settings.enabled
                  ? "Connections to Nexternel are encrypted (https) with Nexternel's own home certificate."
                  : "The secure connection is off: Nexternel is reached over plain http, which is not encrypted."}
                {status.settings.enabled && !onHttps ? " You are on the plain address right now." : ""}
              </Typography>
              {status.settings.enabled && status.addresses.length ? (
                <Box>
                  <Typography variant="subtitle2">Secure addresses</Typography>
                  {status.addresses.map((a) => (
                    <Typography key={a} variant="body2">
                      <Link href={a}>{a}</Link>
                    </Typography>
                  ))}
                </Box>
              ) : null}

              {status.settings.enabled ? (
                <Box>
                  <Typography variant="subtitle2">Trust the home certificate on each device</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Until a device trusts it, the browser shows a warning. Do this once on each phone, tablet and computer.
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ mb: 1 }}>
                    <Button variant="contained" href="/api/v1/system/https/certificate" disabled={!status.homeCertificate}>
                      Download home certificate
                    </Button>
                    <Typography variant="body2" color="text.secondary">
                      or open <Link href={plainLink}>{plainLink}</Link> on the device
                    </Typography>
                  </Stack>
                  <Tabs value={device} onChange={(_, v) => setDevice(v)} variant="scrollable" scrollButtons={false} sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5 } }}>
                    {DEVICE_STEPS.map((d) => (
                      <Tab key={d.id} value={d.id} label={d.label} />
                    ))}
                  </Tabs>
                  <Box component="ol" sx={{ m: 0, mt: 1, pl: 3, display: "grid", gap: 0.5 }}>
                    {steps.steps.map((s) => (
                      <Typography key={s} component="li" variant="body2">
                        {s}
                      </Typography>
                    ))}
                  </Box>
                  {status.homeCertificate ? (
                    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, wordBreak: "break-all" }}>
                      {status.homeCertificate.name}, valid until {day(status.homeCertificate.validTo)}. Fingerprint (SHA-256):{" "}
                      {status.homeCertificate.fingerprint}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">The home certificate is being created…</Typography>
                  )}
                </Box>
              ) : null}

              {notice ? <Alert severity="success">{notice}</Alert> : null}
              {error ? <Alert severity="error">{error}</Alert> : null}

              {canManage ? (
                <>
                  <FormControlLabel
                    control={<Switch checked={status.settings.enabled} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />}
                    label="Secure connection (https)"
                  />
                  {status.settings.enabled ? (
                    <>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
                        <TextField
                          id="https-extra-names"
                          size="small"
                          label="Other names for this server"
                          value={names}
                          onChange={(e) => setNames(e.target.value)}
                          helperText="Optional, separated by commas: e.g. the server's computer name. The address and nexternel.local are always included."
                          sx={{ flex: 1, maxWidth: 520 }}
                        />
                        <Button
                          variant="outlined"
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () => api.saveHttps({ extraNames: names.split(",").map((n) => n.trim()).filter(Boolean) }),
                              "Saved. The home certificate now covers these names."
                            )
                          }
                        >
                          Save names
                        </Button>
                      </Stack>

                      <Box>
                        <Typography variant="subtitle2">Your own domain (optional)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          If you own a domain, point a name such as home.example.com at this server in your domain's DNS
                          settings, get a certificate for it (for example free from Let's Encrypt), and add it here. Devices
                          trust it without installing anything.
                        </Typography>
                        {status.settings.domain && status.domainCertificate ? (
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              <strong>{status.settings.domain}</strong>: certificate from {status.domainCertificate.issuer}, valid until{" "}
                              {day(status.domainCertificate.validTo)}.
                            </Typography>
                            <Button color="error" disabled={busy} onClick={() => void run(api.removeHttpsDomain, "Your domain was removed.")}>
                              Remove
                            </Button>
                          </Stack>
                        ) : (
                          <Stack spacing={1} sx={{ maxWidth: 520 }}>
                            <TextField id="https-domain" size="small" label="Domain name" placeholder="home.example.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Button size="small" variant="outlined" component="label">
                                Certificate file (.crt / .pem)
                                <input ref={certFile} type="file" hidden accept=".crt,.pem,.cer" onChange={() => setNotice(null)} />
                              </Button>
                              <Button size="small" variant="outlined" component="label">
                                Key file (.key / .pem)
                                <input ref={keyFile} type="file" hidden accept=".key,.pem" onChange={() => setNotice(null)} />
                              </Button>
                            </Stack>
                            <Box>
                              <Button
                                variant="contained"
                                disabled={busy || !domain.trim()}
                                onClick={() => {
                                  const c = certFile.current?.files?.[0];
                                  const k = keyFile.current?.files?.[0];
                                  if (!c || !k) {
                                    setError("Choose both the certificate file and its key file.");
                                    return;
                                  }
                                  void run(() => api.setHttpsDomain(domain.trim(), c, k), "Your domain is set up.");
                                }}
                              >
                                Use my domain
                              </Button>
                            </Box>
                          </Stack>
                        )}
                      </Box>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
