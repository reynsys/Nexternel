import { useState } from "react";
import { Alert, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { api } from "../../../api";
import { useContentSurfaceSx } from "../../../skins/useSurfaceStyles";

/**
 * After moving to a new server, ESP boards that cannot reach it over Wi‑Fi need one USB flash.
 * This pack holds every device file ready to flash (this server's MQTT address and Wi‑Fi filled in).
 */
export function DeviceFilesPackCard() {
  const surfaceSx = useContentSurfaceSx();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function download() {
    setBusy(true);
    setNotice(null);
    try {
      const { blob, filename } = await api.downloadEsphomeCutoverPack();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNotice({ ok: true, text: `Downloaded ${filename}. Flash a board with it over USB in ESPHome or web.esphome.io.` });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : "Download failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card sx={surfaceSx}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Device files for USB flashing
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Only needed after moving to a new server: an ESP board that does not come back online on its
          own needs one USB flash with its file from this pack (this server’s address and Wi‑Fi are
          already filled in).
        </Typography>
        {notice && (
          <Alert severity={notice.ok ? "success" : "error"} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}
        <Stack direction="row">
          <Button variant="outlined" disabled={busy} onClick={() => void download()}>
            {busy ? "Preparing…" : "Download device files"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
