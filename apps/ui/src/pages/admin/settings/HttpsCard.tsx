import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { api, type HttpsStatus } from "../../../api";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

/**
 * Settings → System: how to reach Nexternel at home. A secure address that every device trusts
 * without installing anything (an automatic name per home) is being prepared; until then the
 * plain addresses are the normal ones.
 */
export function HttpsCard() {
  const surfaceSx = useContentSurfaceSx();
  const [status, setStatus] = useState<HttpsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .httpsStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the addresses"));
  }, []);

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Addresses</Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!status && !error ? <CircularProgress size={24} /> : null}
          {status ? (
            <>
              <Box>
                <Typography variant="subtitle2">Open Nexternel at home with</Typography>
                {status.localAddresses.map((a) => (
                  <Typography key={a} variant="body2">
                    <Link href={a}>{a}</Link>
                  </Typography>
                ))}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  The name works on phones, tablets and computers on your home network. If a device cannot find it, use the
                  number address.
                </Typography>
              </Box>
              {status.settings.domain && status.domainCertificate ? (
                <Box>
                  <Typography variant="subtitle2">Secure address</Typography>
                  <Typography variant="body2">
                    <Link href={`https://${status.settings.domain}`}>https://{status.settings.domain}</Link>
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Typography variant="subtitle2">Secure address (https): coming soon</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Nexternel will offer each home its own secure name that every phone, tablet and browser trusts
                    straight away, with nothing to install on any device. Everything works on the addresses above in
                    the meantime.
                  </Typography>
                </Box>
              )}
            </>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
