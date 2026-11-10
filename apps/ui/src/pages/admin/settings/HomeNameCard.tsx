import { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { api } from "../../../api";
import { showHomeInTab } from "../../../lib/home-title";
import { ButtonRow } from "../../../components/ButtonRow";

/** Settings → System → Overview: the home's name (set first in the setup wizard; shown in the browser tab). */
export function HomeNameCard({ surfaceSx, canEdit }: { surfaceSx: object; canEdit: boolean }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void api
      .home()
      .then(({ home }) => {
        setSaved(home.name);
        setName(home.name);
      })
      .catch((err) => setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not read the home's name." }));
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const { home } = await api.updateHome({ name });
      setSaved(home.name);
      setName(home.name);
      showHomeInTab(home.name);
      setMsg({ ok: true, text: "Saved." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save the name." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Your home
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Name of your home"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || saved === null || busy}
            inputProps={{ maxLength: 60 }}
            helperText="Shown in the browser tab."
            fullWidth
          />
          {msg && <Alert severity={msg.ok ? "success" : "error"} onClose={() => setMsg(null)}>{msg.text}</Alert>}
          {canEdit && (
            <ButtonRow direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => void save()} disabled={busy || saved === null || name.trim() === saved}>
                Save
              </Button>
            </ButtonRow>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
