import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { isPhoneScreen } from "../lib/phone-screen";
import { ButtonRow } from "./ButtonRow";

/**
 * "This phone" / "This tablet" (at the bottom of the menu): Nexternel for Android's version, its own
 * "Check for update" / "Update to …" button and Change home, side by side (rarely needed, so low down).
 * Shown only inside Nexternel for Android 1.0.1 or newer (the frame offers window.NexternelPhone).
 * The frame does the work (GitHub check, download, Android's "Install update?") and answers with
 * the "nexternel-phone-update" event.
 */
type PhoneState = { current?: string; latest?: string | null; checked?: boolean; failed?: boolean; checking?: boolean };
type Phone = { updateState(): string; checkForUpdate(): void; installUpdate(): void; changeHome?: () => void };

function phone(): Phone | null {
  const p = (window as unknown as { NexternelPhone?: Partial<Phone> }).NexternelPhone;
  return p && typeof p.checkForUpdate === "function" && typeof p.updateState === "function" && typeof p.installUpdate === "function"
    ? (p as Phone)
    : null;
}

function readState(p: Phone): PhoneState {
  try {
    return JSON.parse(p.updateState()) as PhoneState;
  } catch {
    return {};
  }
}

export function AndroidUpdate({ px = 2, pb = 1 }: { px?: number; pb?: number }) {
  const p = phone();
  const [state, setState] = useState<PhoneState>(() => (p ? readState(p) : {}));
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!p) return;
    const onAnswer = (e: Event) => {
      setState((e as CustomEvent<PhoneState>).detail ?? {});
      setChecking(false);
    };
    window.addEventListener("nexternel-phone-update", onAnswer);
    return () => window.removeEventListener("nexternel-phone-update", onAnswer);
  }, [p]);

  if (!p) return null;

  const latest = state.latest ?? null;
  const busy = checking || Boolean(state.checking);
  let note: string | null = null;
  if (!busy && state.checked && !latest) note = state.failed ? "Could not check. Check the internet connection." : "This is the newest version.";

  const changeHome = typeof p.changeHome === "function";
  return (
    <Box sx={{ px, pb }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
        {isPhoneScreen() ? "This phone" : "This tablet"} · Nexternel for Android {state.current ?? ""}
      </Typography>
      <ButtonRow direction="row" flexWrap="wrap">
        {latest ? (
          <Button size="small" variant="contained" sx={{ flex: "1 1 auto", whiteSpace: "nowrap" }} onClick={() => p.installUpdate()}>
            Update to {latest}
          </Button>
        ) : (
          <Button
            size="small"
            variant="outlined"
            sx={{ flex: "1 1 auto", whiteSpace: "nowrap" }}
            disabled={busy}
            onClick={() => {
              setChecking(true);
              p.checkForUpdate();
            }}
          >
            {busy ? "Checking…" : "Check for update"}
          </Button>
        )}
        {changeHome ? <ChangeHome p={p} /> : null}
      </ButtonRow>
      {note ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
          {note}
        </Typography>
      ) : null}
    </Box>
  );
}

/**
 * Change home: this phone asks for another home (Nexternel for Android 1.0.2 or newer). It asks
 * first, so it is not pressed by mistake. (The home's address is at the top of the menu.)
 */
function ChangeHome({ p }: { p: Phone }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button size="small" variant="outlined" sx={{ flex: "1 1 auto", whiteSpace: "nowrap" }} onClick={() => setAsking(true)}>
        Change home
      </Button>
      <Dialog open={asking} onClose={() => setAsking(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change home?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This phone will ask for another home name or address. Your home and its settings stay as they are.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAsking(false)}>
            Stay here
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setAsking(false);
              p.changeHome?.();
            }}
          >
            Change home
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Inside Nexternel for Android (the frame offers window.NexternelPhone). */
export function inPhoneFrame(): boolean {
  return phone() !== null;
}
