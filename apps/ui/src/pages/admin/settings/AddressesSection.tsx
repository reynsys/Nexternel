import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Link, Stack, Typography } from "@mui/material";
import { api, type HttpsStatus } from "../../../api";

/**
 * Settings → System → Addresses (a section of the System card): how to reach Nexternel at home. A secure address that every device trusts
 * without installing anything (an automatic name per home) is being prepared; until then the
 * plain addresses are the normal ones.
 */
export function AddressesSection() {
  const [status, setStatus] = useState<HttpsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .httpsStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the addresses"));
  }, []);

  return (
        <Stack spacing={2}>
          <Typography variant="h6">Addresses</Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!status && !error ? <CircularProgress size={24} /> : null}
          {status ? (
            <>
              <Box>
                <Typography variant="subtitle2">On Nexternel's network</Typography>
                {status.localAddresses.map((a) => (
                  <Typography key={a} variant="body2">
                    <Link href={a}>{a}</Link>
                  </Typography>
                ))}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  If the name doesn't open, use the number.
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2">Wall displays and tablets</Typography>
                <Typography variant="body2">
                  <Link href={`${status.localAddresses[0] ?? ""}/display`}>{status.localAddresses[0] ?? ""}/display</Link>
                </Typography>
              </Box>
              {status.settings.domain && status.domainCertificate ? (
                <Box>
                  <Typography variant="subtitle2">Secure address</Typography>
                  <Typography variant="body2">
                    <Link href={`https://${status.settings.domain}`}>https://{status.settings.domain}</Link>
                  </Typography>
                </Box>
              ) : null}
            </>
          ) : null}
        </Stack>
  );
}
