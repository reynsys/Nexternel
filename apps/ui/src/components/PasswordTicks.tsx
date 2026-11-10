import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { MIN_PASSWORD_LENGTH } from "@nexternel/domain";
import { ICON_SIZE } from "../lib/appearance/type";
import { api, type PasswordCheck } from "../api";

/** The rules before anything is typed (the server's list replaces it as soon as it answers). */
const START: PasswordCheck[] = [
  { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, ok: false },
  { id: "common", label: "Not a well-known password", ok: false },
  { id: "username", label: "Not too close to your username", ok: false },
  { id: "variety", label: "Not the same few characters over and over", ok: false },
];

/** Every check passed (the form's Next button waits for this). */
export function passwordChecksPass(checks: PasswordCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => c.ok);
}

/**
 * The password rules as ticks while typing, from the server's own rules (one rule, so the ticks
 * and the final check always agree). Reports the checks up so the form can wait for them.
 */
export function PasswordTicks({ password, username, onChecks }: { password: string; username: string; onChecks?: (checks: PasswordCheck[]) => void }) {
  const [checks, setChecks] = useState<PasswordCheck[]>(START);

  useEffect(() => {
    if (!password) {
      setChecks(START);
      onChecks?.(START);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      void api
        .passwordCheck(password, username)
        .then(({ checks: next }) => {
          if (stale) return;
          setChecks(next);
          onChecks?.(next);
        })
        .catch(() => {
          /* the final check on the server still applies; the ticks just stay as they were */
        });
    }, 250);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
    // onChecks is a callback from the form; re-running for it would only repeat the same request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, username]);

  return (
    <Stack spacing={0.25} aria-live="polite">
      {checks.map((c) => (
        <Box key={c.id} sx={{ display: "flex", alignItems: "center", gap: 0.75, color: c.ok ? "success.main" : "text.secondary" }}>
          {c.ok ? <CheckCircleRoundedIcon sx={{ fontSize: ICON_SIZE.inline }} /> : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: ICON_SIZE.inline }} />}
          <Typography variant="caption" color="inherit">
            {c.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
