import { useEffect, useState } from "react";
import { Alert, Button, IconButton, InputAdornment, Stack, TextField, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { api } from "../api";
import { ButtonRow } from "./ButtonRow";

export type DevicesWifiValue = { ssid: string; password: string };

/**
 * "Wi-Fi for your devices": the name and password of the home Wi-Fi that boards join.
 * The same fields everywhere the setting is asked (setup wizard, Settings → System, Add device).
 */
export function DevicesWifiFields(props: {
  value: DevicesWifiValue;
  onChange: (next: DevicesWifiValue) => void;
  /** A password is already saved: leaving the box empty keeps it. */
  passwordSet?: boolean;
  disabled?: boolean;
  idPrefix: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Stack spacing={2}>
      <TextField
        id={`${props.idPrefix}-ssid`}
        label="Wi-Fi name"
        value={props.value.ssid}
        onChange={(e) => props.onChange({ ...props.value, ssid: e.target.value })}
        disabled={props.disabled}
        inputProps={{ maxLength: 32, autoCapitalize: "none", spellCheck: false }}
        autoComplete="off"
        fullWidth
      />
      <TextField
        id={`${props.idPrefix}-password`}
        label="Wi-Fi password"
        type={show ? "text" : "password"}
        value={props.value.password}
        onChange={(e) => props.onChange({ ...props.value, password: e.target.value })}
        disabled={props.disabled}
        autoComplete="new-password"
        helperText={props.passwordSet ? "Saved. Leave empty to keep it, or type a new one." : "The password you use to join this Wi-Fi."}
        fullWidth
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} edge="end">
                {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </Stack>
  );
}

/** The fields with their own Save: loads what is saved, saves it, then calls onSaved. */
export function DevicesWifiForm(props: { idPrefix: string; onSaved?: () => void; saveLabel?: string; canEdit?: boolean }) {
  const [value, setValue] = useState<DevicesWifiValue>({ ssid: "", password: "" });
  const [saved, setSaved] = useState<{ ssid: string | null; passwordSet: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const canEdit = props.canEdit ?? true;

  useEffect(() => {
    void api
      .devicesWifi()
      .then((w) => {
        setSaved(w);
        setValue({ ssid: w.ssid ?? "", password: "" });
      })
      .catch((err) => setMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't read the Wi-Fi for your devices." }));
  }, []);

  const changed = saved !== null && (value.ssid.trim() !== (saved.ssid ?? "") || value.password !== "");

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const w = await api.saveDevicesWifi(value);
      setSaved(w);
      setValue({ ssid: w.ssid ?? "", password: "" });
      setMsg({ ok: true, text: "Saved." });
      props.onSaved?.();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "The Wi-Fi couldn't be saved. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={2}>
      <DevicesWifiFields
        idPrefix={props.idPrefix}
        value={value}
        onChange={setValue}
        passwordSet={saved?.passwordSet}
        disabled={!canEdit || saved === null || busy}
      />
      {msg && (
        <Alert severity={msg.ok ? "success" : "error"} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}
      {canEdit && (
        <ButtonRow direction="row" justifyContent="flex-end">
          <Button variant="contained" onClick={() => void save()} disabled={busy || !changed}>
            {busy ? "Saving…" : props.saveLabel ?? "Save"}
          </Button>
        </ButtonRow>
      )}
    </Stack>
  );
}

export function DevicesWifiExplainer() {
  return (
    <Typography variant="body2" color="text.secondary">
      The Wi-Fi your boards join. Nexternel puts it into each board's software, so boards work without you typing it on
      every one. It's kept on your Nexternel only.
    </Typography>
  );
}
